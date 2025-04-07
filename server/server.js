const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const { generatePdf } = require("./pdf");

// Load environment variables
require("dotenv").config();

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with proper CORS settings
const io = new Server(server, {
	cors: {
		origin: "*", // Allow all origins in development
		methods: ["GET", "POST"],
		allowedHeaders: ["my-custom-header"],
		credentials: true
	}
});

// Ensure PDF storage directory exists
const storageDir = process.env.PDF_STORAGE_PATH || "./storage/waivers";
if (!fs.existsSync(storageDir)) {
	fs.mkdirSync(storageDir, { recursive: true });
}

// Track connected tablets
const connectedTablets = new Map();

// Socket.IO connection handling
io.on("connection", (socket) => {
	console.log("Client connected:", socket.id);
	
	// Register a tablet
	socket.on("register-tablet", ({ tabletName }, callback) => {
		const tabletId = socket.id;
		
		// Store tablet info
		connectedTablets.set(tabletId, {
			id: tabletId,
			name: tabletName,
			status: "available",
			players: []
		});
		
		// Broadcast updated tablet list to all admins
		io.emit("tablets-update", Array.from(connectedTablets.values()));
		
		// Confirm registration
		if (callback && typeof callback === "function") {
			callback({
				success: true,
				tabletId
			});
		}
		
		console.log(`Tablet registered: ${tabletName} (${tabletId})`);
	});
	
	// Send players to a tablet
	socket.on("send-players", ({ tabletId, players, activityType }) => {
		const targetSocket = io.sockets.sockets.get(tabletId);
		
		if (targetSocket && connectedTablets.has(tabletId)) {
			// Update tablet status
			const tablet = connectedTablets.get(tabletId);
			tablet.status = "busy";
			tablet.players = players;
			
			// Send players to the tablet
			targetSocket.emit("players-assigned", {
				players,
				activityType
			});
			
			// Broadcast updated tablet list
			io.emit("tablets-update", Array.from(connectedTablets.values()));
			
			console.log(`Sent ${players.length} players to tablet ${tablet.name}`);
		}
	});
	
	// Handle player signature
	socket.on("player-signed", async ({ tabletId, playerName, activityType, signatureData }) => {
		if (!connectedTablets.has(tabletId)) return;
		
		try {
			// Generate PDF with signature
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const filename = `${playerName.replace(/\s+/g, "_")}_${timestamp}.pdf`;
			const filePath = path.join(storageDir, filename);
			
			await generatePdf({
				playerName,
				activityType,
				signatureData,
				outputPath: filePath
			});
			
			console.log(`Waiver PDF created for ${playerName} at ${filePath}`);
			
			// Check if all players have signed
			const tablet = connectedTablets.get(tabletId);
			const signedPlayerIndex = tablet.players.indexOf(playerName);
			
			if (signedPlayerIndex !== -1) {
				// Remove player from the list
				tablet.players.splice(signedPlayerIndex, 1);
				
				// Update tablet status if all players have signed
				if (tablet.players.length === 0) {
					tablet.status = "available";
				}
				
				// Broadcast updated tablet list
				io.emit("tablets-update", Array.from(connectedTablets.values()));
			}
		} catch (error) {
			console.error("Error generating PDF:", error);
		}
	});
	
	// Handle disconnection
	socket.on("disconnect", () => {
		const tabletId = socket.id;
		
		if (connectedTablets.has(tabletId)) {
			connectedTablets.delete(tabletId);
			io.emit("tablets-update", Array.from(connectedTablets.values()));
			console.log(`Tablet disconnected: ${tabletId}`);
		}
		
		console.log("Client disconnected:", socket.id);
	});
});

// Middleware to handle CORS for regular HTTP requests
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "../dist")));
	
	app.get("/*", (req, res) => {
		res.sendFile(path.join(__dirname, "../dist/index.html"));
	});
}

// API endpoint to check server status
app.get("/api/status", (req, res) => {
	res.json({
		status: "ok",
		tablets: connectedTablets.size,
		uptime: process.uptime()
	});
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

// Handle process termination
process.on("SIGINT", () => {
	console.log("Shutting down server...");
	server.close(() => {
		console.log("Server shut down");
		process.exit(0);
	});
});
