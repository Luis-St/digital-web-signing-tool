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
// Now using tablet name as the key instead of connection ID
const connectedTablets = new Map();
const tabletConnections = new Map(); // Maps tablet names to their connection objects
const clientConnections = new Map(); // Maps connection IDs to connection objects
const adminConnections = new Set(); // Just store admin connection objects

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
	ws.tabletName = null; // Will be set during registration
	
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
				if (!adminConnections.has(ws)) {
					console.log(`Marking client ${connectionId} as admin`);
					adminConnections.add(ws);
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
		adminConnections.delete(ws);
		
		// If this was a tablet, mark it as disconnected but DON'T remove it
		// This allows reconnection with the same tablet name
		if (ws.isTablet && ws.tabletName) {
			const tabletName = ws.tabletName;
			if (connectedTablets.has(tabletName)) {
				const tablet = connectedTablets.get(tabletName);
				tablet.connected = false;
				tabletConnections.delete(tabletName);
				
				// Broadcast the status change
				broadcast("tablets-update", Array.from(connectedTablets.values()));
				console.log(`Tablet disconnected: ${tabletName}`);
			}
		}
		
		console.log("Client disconnected:", connectionId);
	});
	
	// Handle errors
	ws.on("error", (error) => {
		console.error("WebSocket error:", error);
	});
	
	// Send current tablet list to new connections (especially for admins)
	setTimeout(() => {
		const tablets = Array.from(connectedTablets.values()).filter(tablet => tablet.connected); // Only send connected tablets
		
		sendToClient(ws, "tablets-update", tablets);
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
		
		case "update-tablet-status":
			updateTabletStatus(ws, data);
			break;
		
		case "get-tablets":
			// Send current tablets list to the requesting client
			const tablets = Array.from(connectedTablets.values()).filter(tablet => tablet.connected);
			
			sendToClient(ws, "tablets-update", tablets);
			break;
		
		default:
			console.warn(`Unknown event: ${event}`);
	}
}

// Register a tablet
function registerTablet(ws, { tabletName }, id) {
	if (!tabletName) {
		sendToClient(ws, "register-tablet-response", {
			success: false,
			message: "Tablet name is required",
		}, id);
		return;
	}
	
	// Mark this connection as a tablet
	ws.isTablet = true;
	ws.tabletName = tabletName;
	
	// Check if this tablet name already exists
	let tabletData;
	if (connectedTablets.has(tabletName)) {
		// Update existing tablet with new connection
		tabletData = connectedTablets.get(tabletName);
		tabletData.connected = true;
		
		console.log(`Tablet reconnected: ${tabletName}`);
	} else {
		// Create new tablet entry
		tabletData = {
			name: tabletName,
			status: "available",
			players: [],
			connected: true,
		};
		connectedTablets.set(tabletName, tabletData);
		
		console.log(`New tablet registered: ${tabletName}`);
	}
	
	// Map this tablet name to the connection
	tabletConnections.set(tabletName, ws);
	
	// Broadcast updated tablet list to all clients
	const tablets = Array.from(connectedTablets.values())
		.filter(tablet => tablet.connected);
	
	broadcast("tablets-update", tablets);
	
	// Confirm registration with callback
	if (id) {
		sendToClient(ws, "register-tablet-response", {
			success: true,
			tabletName,
		}, id);
	}
}

// Send players to a tablet - sending player count instead of player names
function sendPlayersToTablet(ws, { tabletName, playerCount, activityType }) {
	// Find the target client by tablet name
	const targetClient = tabletConnections.get(tabletName);
	
	if (targetClient && connectedTablets.has(tabletName)) {
		// Update tablet status
		const tablet = connectedTablets.get(tabletName);
		tablet.status = "busy";
		tablet.players = []; // Initialize empty array - player names will be set on the tablet
		
		// Send player count and activity type to the tablet
		sendToClient(targetClient, "players-assigned", {
			playerCount,
			activityType,
		});
		
		// Broadcast updated tablet list
		const tablets = Array.from(connectedTablets.values())
			.filter(tablet => tablet.connected);
		
		broadcast("tablets-update", tablets);
		
		console.log(`Sent player count ${playerCount} to tablet ${tablet.name}`);
	} else {
		console.warn(`Cannot find tablet with name: ${tabletName}`);
	}
}

// Update tablet status
function updateTabletStatus(ws, { tabletName, status }) {
	if (!ws.isTablet) {
		console.warn("Non-tablet client tried to update tablet status");
		return;
	}
	
	// Use the sender's tablet name if not specified
	tabletName = tabletName || ws.tabletName;
	
	if (!tabletName || !connectedTablets.has(tabletName)) {
		console.warn(`Cannot update status for unknown tablet: ${tabletName}`);
		return;
	}
	
	// Update tablet status
	const tablet = connectedTablets.get(tabletName);
	tablet.status = status;
	
	console.log(`Updated tablet ${tablet.name} status to: ${status}`);
	
	// If status is "available", clear the players array
	if (status === "available") {
		tablet.players = [];
	}
	
	// Broadcast updated tablet list
	const tablets = Array.from(connectedTablets.values()).filter(tablet => tablet.connected);
	
	broadcast("tablets-update", tablets);
}

// Handle player signature
async function handlePlayerSigned(ws, { tabletName, playerName, activityType, signatureData, birthdate }) {
	// Use the sender's tablet name if not specified
	tabletName = tabletName || ws.tabletName;
	
	if (!tabletName || !connectedTablets.has(tabletName)) {
		console.warn(`Cannot process signature for unknown tablet: ${tabletName}`);
		return;
	}
	
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
			birthdate, // Add the birthdate to the PDF generation
		});
		
		console.log(`Waiver PDF created for ${playerName} at ${filePath}`);
		
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
		
		const tablets = Array.from(connectedTablets.values()).filter(tablet => tablet.connected);
		
		broadcast("tablets-update", tablets, "admin");
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
	const connectedTabletCount = Array.from(connectedTablets.values())
		.filter(tablet => tablet.connected).length;
	
	res.json({
		status: "ok",
		tablets: connectedTabletCount,
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
