import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useWebSocket } from "@vueuse/core";

export const useTabletsStore = defineStore("tablets", () => {
	// Use localStorage to persist tablet authentication state
	const storedTabletName = localStorage.getItem("tabletName") || null;
	const storedTabletAuth = localStorage.getItem("tabletAuth") === "true";
	
	const currentTabletName = ref(storedTabletName);
	const isTabletAuthenticated = ref(storedTabletAuth);
	const wsInitialized = ref(false);
	
	// WebSocket connection using VueUse
	const socketUrl = computed(() => import.meta.env.VITE_SOCKET_URL || "ws://localhost:5000");
	
	// Event handlers
	const eventHandlers = ref(new Map());
	
	// Callback tracking
	const pendingCallbacks = ref(new Map());
	let callbackCounter = 0;
	
	// Set up WebSocket with VueUse - but don't connect immediately
	const {
		status,
		data: lastMessage,
		send: sendRaw,
		open: openConnection,
		close: closeConnection,
		ws: wsRef,
	} = useWebSocket(socketUrl, {
		autoReconnect: {
			retries: 10,
			delay: 1000,
			onFailed() {
				console.error("Failed to connect WebSocket after multiple retries");
			},
		},
		heartbeat: {
			message: JSON.stringify({ type: "ping" }),
			interval: 30000,
		},
		autoClose: false, // Don't auto-close on component unmount
		immediate: false, // Don't connect immediately
		onConnected() {
			console.log("Tablet WebSocket connected");
			
			// If we have a stored tablet name, try to reconnect
			if (isTabletAuthenticated.value && currentTabletName.value) {
				console.log("Attempting to reconnect tablet:", currentTabletName.value);
				sendMessage("register-tablet", { tabletName: currentTabletName.value });
			}
		},
		onDisconnected() {
			console.log("Tablet WebSocket disconnected");
		},
		onError(err) {
			console.error("Tablet WebSocket error:", err);
		},
		onMessage(ws, event) {
			try {
				const message = JSON.parse(event.data);
				console.log("Tablet WebSocket message received:", message);
				
				if (message.type === "event") {
					// Handle registered event handlers
					const handlers = eventHandlers.value.get(message.event) || [];
					handlers.forEach(handler => handler(message.data));
				} else if (message.type === "callback" && message.id) {
					// Handle callback
					const callback = pendingCallbacks.value.get(message.id);
					if (callback) {
						callback(message.data);
						pendingCallbacks.value.delete(message.id);
					}
				}
			} catch (error) {
				console.error("Error processing WebSocket message:", error);
			}
		},
	});
	
	// Computed property for connection status
	const isConnected = computed(() => status.value === "OPEN");
	
	// Register event handler
	function on(event, handler) {
		if (!eventHandlers.value.has(event)) {
			eventHandlers.value.set(event, []);
		}
		eventHandlers.value.get(event).push(handler);
		
		console.log(`Registered tablet handler for event: ${event}`);
	}
	
	// Remove event handler
	function off(event, handler) {
		if (!eventHandlers.value.has(event)) return;
		
		if (handler) {
			const handlers = eventHandlers.value.get(event);
			const index = handlers.indexOf(handler);
			if (index !== -1) {
				handlers.splice(index, 1);
			}
		} else {
			eventHandlers.value.delete(event);
		}
		
		console.log(`Removed tablet handler for event: ${event}`);
	}
	
	// Send message with optional callback
	function sendMessage(event, data, callback) {
		if (!isConnected.value) {
			console.warn("Cannot send message, Tablet WebSocket not connected");
			return false;
		}
		
		// Always include tablet name in messages if authenticated
		const messageData = {
			...data,
			isAdmin: false, // Explicitly mark as not admin
		};
		
		// Add tablet name to all messages if authenticated
		if (isTabletAuthenticated.value && currentTabletName.value) {
			messageData.tabletName = currentTabletName.value;
		}
		
		const message = {
			type: "event",
			event,
			data: messageData,
		};
		
		if (callback) {
			const id = `cb_${Date.now()}_${callbackCounter++}`;
			message.id = id;
			pendingCallbacks.value.set(id, callback);
			
			// Set timeout to clean up callback if no response
			setTimeout(() => {
				if (pendingCallbacks.value.has(id)) {
					console.warn(`Callback for event ${event} timed out`);
					pendingCallbacks.value.delete(id);
				}
			}, 10000);
		}
		
		console.log(`Tablet sending message: ${event}`, message.data);
		sendRaw(JSON.stringify(message));
		return true;
	}
	
	// Initialize socket connection
	function initSocket() {
		console.log("Initializing Tablet WebSocket connection");
		
		// Only open if not already connected
		if (status.value !== "OPEN") {
			openConnection();
			wsInitialized.value = true;
		} else {
			console.log("Tablet WebSocket already connected");
		}
	}
	
	// Register a tablet
	function registerTablet(tabletName, token) {
		console.log("Registering tablet:", tabletName);
		
		// Verify token immediately
		const validToken = import.meta.env.VITE_TABLET_TOKEN;
		console.log("Token valid:", token === validToken);
		
		if (token !== validToken) {
			console.error("Invalid tablet token");
			return Promise.reject(new Error("Invalid tablet token"));
		}
		
		// Initialize socket if not already done
		if (!wsInitialized.value) {
			initSocket();
		}
		
		return new Promise((resolve, reject) => {
			// Check for connection periodically
			const connectionCheckInterval = setInterval(() => {
				if (isConnected.value) {
					clearInterval(connectionCheckInterval);
					
					// Send registration request once connected
					sendMessage("register-tablet", { tabletName }, (response) => {
						if (response && response.success) {
							console.log("Tablet registration successful:", response);
							
							// Store tablet info in state and localStorage
							currentTabletName.value = tabletName;
							isTabletAuthenticated.value = true;
							
							localStorage.setItem("tabletName", tabletName);
							localStorage.setItem("tabletAuth", "true");
							
							resolve(response);
						} else {
							console.error("Tablet registration failed:", response?.message || "Unknown error");
							reject(new Error(response?.message || "Failed to register tablet"));
						}
					});
				} else {
					console.log("Waiting for WebSocket connection...");
				}
			}, 500);
			
			// Set a timeout for the entire operation
			setTimeout(() => {
				clearInterval(connectionCheckInterval);
				if (!isTabletAuthenticated.value) {
					console.error("Tablet registration timed out");
					reject(new Error("Connection timed out. Please try again."));
				}
			}, 15000);
		});
	}
	
	// Manually set tablet as authenticated (for testing without server)
	function manualAuthenticate(tabletName) {
		console.log("Manual tablet authentication for testing");
		
		currentTabletName.value = tabletName;
		isTabletAuthenticated.value = true;
		
		localStorage.setItem("tabletName", tabletName);
		localStorage.setItem("tabletAuth", "true");
	}
	
	function disconnectTablet() {
		console.log("Disconnecting tablet");
		
		// Update tablet status to offline before disconnecting
		if (isConnected.value && currentTabletName.value) {
			try {
				sendMessage("update-tablet-status", {
					tabletName: currentTabletName.value,
					status: "available",
				});
			} catch (error) {
				console.error("Error updating tablet status:", error);
			}
		}
		
		if (wsInitialized.value && status.value !== "CLOSED") {
			try {
				closeConnection();
			} catch (error) {
				console.error("Error closing WebSocket:", error);
			}
		}
		
		wsInitialized.value = false;
		currentTabletName.value = null;
		isTabletAuthenticated.value = false;
		
		localStorage.removeItem("tabletName");
		localStorage.removeItem("tabletAuth");
	}
	
	// Automatically initialize WebSocket when authenticated
	watch(isTabletAuthenticated, (newValue) => {
		if (newValue && !wsInitialized.value) {
			initSocket();
		}
	}, { immediate: true });
	
	return {
		currentTabletName,
		isTabletAuthenticated,
		isConnected,
		on,
		off,
		sendMessage,
		initSocket,
		registerTablet,
		manualAuthenticate,
		disconnectTablet,
	};
}, {
	persist: false, // Don't persist to avoid cross-contamination
});
