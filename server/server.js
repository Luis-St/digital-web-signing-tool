const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");
const fs = require("fs");
const { generatePdf } = require("./pdf");

// Load environment variables
require("dotenv").config();

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Ensure PDF storage directory exists
const storageDir = process.env.PDF_STORAGE_PATH || "./storage/waivers";
if (!fs.existsSync(storageDir)) {
	fs.mkdirSync(storageDir, { recursive: true });
}

// Track connected tablets and admin clients
const connectedTablets = new Map();
const clientConnections = new Map();
const adminConnections = new Map();

// Heartbeat functionality to detect dead connections
function heartbeat() {
	this.isAlive = true;
}

// Helper to send a message to a specific client
function sendToClient(client, event, data, id = null) {
	if (client.readyState === 1) { // OPEN
		client.send(JSON.stringify({
			type: id ? "callback" : "event",
			event,
			data,
			id,
		}));
	}
}

// Helper to broadcast to all clients
function broadcast(event, data, targetType = "all") {
	wss.clients.forEach(client => {
		if (client.readyState === 1) { // OPEN
			// Skip if we're targeting only admins and this is not an admin
			if (targetType === "admin" && !client.isAdmin) return;
			
			// Skip if we're targeting only tablets and this is not a tablet
			if (targetType === "tablet" && !client.isTablet) return;
			
			client.send(JSON.stringify({
				type: "event",
				event,
				data,
			}));
		}
	});
}

// WebSocket server connection handling
wss.on("connection", (ws, req) => {
	// Setup connection
	const clientIp = req.socket.remoteAddress;
	
	// Assign a unique ID to this connection
	const connectionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
	ws.id = connectionId;
	ws.isAdmin = false; // Default - not an admin until proven otherwise
	ws.isTablet = false; // Default - not a tablet until registered
	
	// Setup heartbeat
	ws.isAlive = true;
	ws.on("pong", heartbeat);
	
	console.log(`Client connected: ${connectionId} from ${clientIp}`);
	clientConnections.set(connectionId, ws);
	
	// Handle incoming messages
	ws.on("message", (message) => {
		try {
			const parsed = JSON.parse(message);
			const { type, event, data = {}, id } = parsed;
			
			// Check if this is an admin client
			if (data && data.isAdmin) {
				ws.isAdmin = true;
				if (!adminConnections.has(connectionId)) {
					console.log(`Marking client ${connectionId} as admin`);
					adminConnections.set(connectionId, ws);
				}
			}
			
			console.log(`Received ${type} message:`, parsed);
			
			if (type === "event") {
				handleEvent(ws, event, data, id);
			} else if (type === "ping") {
				// Respond to heartbeat
				ws.send(JSON.stringify({ type: "pong" }));
			}
		} catch (error) {
			console.error("Error processing message:", error, message.toString());
		}
	});
	
	// Handle disconnection
	ws.on("close", () => {
		const connectionId = ws.id;
		clientConnections.delete(connectionId);
		adminConnections.delete(connectionId);
		
		if (connectedTablets.has(connectionId)) {
			connectedTablets.delete(connectionId);
			broadcast("tablets-update", Array.from(connectedTablets.values()));
			console.log(`Tablet disconnected: ${connectionId}`);
		}
		
		console.log("Client disconnected:", connectionId);
	});
	
	// Handle errors
	ws.on("error", (error) => {
		console.error("WebSocket error:", error);
	});
	
	// Send current tablet list to new connections (especially for admins)
	setTimeout(() => {
		sendToClient(ws, "tablets-update", Array.from(connectedTablets.values()));
	}, 1000);
});

// Event handler
function handleEvent(ws, event, data, id) {
	switch (event) {
		case "register-tablet":
			// Skip tablet registration for admin clients
			if (ws.isAdmin) {
				console.log("Admin client tried to register as tablet - ignoring");
				sendToClient(ws, "register-tablet-response", {
					success: false,
					message: "Admin clients cannot register as tablets",
				}, id);
				return;
			}
			registerTablet(ws, data, id);
			break;
		
		case "send-players":
			sendPlayersToTablet(ws, data);
			break;
		
		case "player-signed":
			handlePlayerSigned(ws, data).then(r => r);
			break;
		
		case "get-tablets":
			// Send current tablets list to the requesting client
			sendToClient(ws, "tablets-update", Array.from(connectedTablets.values()));
			break;
		
		default:
			console.warn(`Unknown event: ${event}`);
	}
}

// Register a tablet
function registerTablet(ws, { tabletName }, id) {
	const tabletId = ws.id;
	
	// Mark this connection as a tablet
	ws.isTablet = true;
	
	// Store tablet info
	connectedTablets.set(tabletId, {
		id: tabletId,
		name: tabletName,
		status: "available",
		players: [],
	});
	
	// Broadcast updated tablet list to all clients
	broadcast("tablets-update", Array.from(connectedTablets.values()));
	
	// Confirm registration with callback
	if (id) {
		sendToClient(ws, "register-tablet-response", {
			success: true,
			tabletId,
		}, id);
	}
	
	console.log(`Tablet registered: ${tabletName} (${tabletId})`);
}

// Send players to a tablet
function sendPlayersToTablet(ws, { tabletId, players, activityType }) {
	// Find the target client by ID
	const targetClient = clientConnections.get(tabletId);
	
	if (targetClient && connectedTablets.has(tabletId)) {
		// Update tablet status
		const tablet = connectedTablets.get(tabletId);
		tablet.status = "busy";
		tablet.players = players;
		
		// Send players to the tablet
		sendToClient(targetClient, "players-assigned", {
			players,
			activityType,
		});
		
		// Broadcast updated tablet list
		broadcast("tablets-update", Array.from(connectedTablets.values()));
		
		console.log(`Sent ${players.length} players to tablet ${tablet.name}`);
	} else {
		console.warn(`Cannot find tablet with ID: ${tabletId}`);
	}
}

// Handle player signature
async function handlePlayerSigned(ws, { tabletId, playerName, activityType, signatureData }) {
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
			outputPath: filePath,
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
			broadcast("tablets-update", Array.from(connectedTablets.values()));
		}
		
		// Send confirmation to the tablet
		sendToClient(ws, "signature-confirmed", {
			playerName,
			success: true,
		});
	} catch (error) {
		console.error("Error generating PDF:", error);
		
		// Send error to the tablet
		sendToClient(ws, "signature-confirmed", {
			playerName,
			success: false,
			error: error.message,
		});
	}
}

// Set up interval to check for dead connections
const interval = setInterval(() => {
	wss.clients.forEach(ws => {
		if (ws.isAlive === false) {
			console.log(`Terminating inactive connection: ${ws.id}`);
			return ws.terminate();
		}
		
		ws.isAlive = false;
		ws.ping();
	});
}, 30000);

// Also set up a periodic broadcast of tablet updates to admin clients
const tabletUpdateInterval = setInterval(() => {
	if (adminConnections.size > 0 && connectedTablets.size > 0) {
		console.log("Broadcasting tablet updates to admin clients");
		broadcast("tablets-update", Array.from(connectedTablets.values()), "admin");
	}
}, 10000); // Every 10 seconds

wss.on("close", () => {
	clearInterval(interval);
	clearInterval(tabletUpdateInterval);
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
		connections: clientConnections.size,
		admins: adminConnections.size,
		uptime: process.uptime(),
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
