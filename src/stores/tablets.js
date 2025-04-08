import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useWebSocket } from "@vueuse/core";

export const useTabletsStore = defineStore("tablets", () => {
	// Use localStorage to persist tablet authentication state
	const storedTabletId = localStorage.getItem("tabletId") || null;
	const storedTabletName = localStorage.getItem("tabletName") || null;
	const storedTabletAuth = localStorage.getItem("tabletAuth") === "true";
	
	const tablets = ref([]);
	const selectedTabletId = ref(null);
	const currentTabletId = ref(storedTabletId);
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
			console.log("WebSocket connected");
			
			// If we have a stored tablet ID, try to re-register with the server
			if (isTabletAuthenticated.value && currentTabletId.value && currentTabletName.value) {
				console.log("Attempting to reconnect tablet:", currentTabletName.value);
				sendMessage("register-tablet", { tabletName: currentTabletName.value });
			}
		},
		onDisconnected() {
			console.log("WebSocket disconnected");
		},
		onError(err) {
			console.error("WebSocket error:", err);
		},
		onMessage(ws, event) {
			try {
				const message = JSON.parse(event.data);
				console.log("WebSocket message received:", message);
				
				if (message.type === "event") {
					// Handle event
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
		
		console.log(`Registered handler for event: ${event}`);
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
		
		console.log(`Removed handler for event: ${event}`);
	}
	
	// Send message with optional callback
	function sendMessage(event, data, callback) {
		if (!isConnected.value) {
			console.warn("Cannot send message, WebSocket not connected");
			return false;
		}
		
		const message = {
			type: "event",
			event,
			data,
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
		
		console.log(`Sending message: ${event}`, data);
		sendRaw(JSON.stringify(message));
		return true;
	}
	
	// Initialize socket connection
	function initSocket() {
		console.log("Initializing WebSocket connection");
		
		// Only open if not already connected
		if (status.value !== "OPEN") {
			openConnection();
			wsInitialized.value = true;
		} else {
			console.log("WebSocket already connected");
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
							currentTabletId.value = response.tabletId;
							currentTabletName.value = tabletName;
							isTabletAuthenticated.value = true;
							
							localStorage.setItem("tabletId", response.tabletId);
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
		
		currentTabletId.value = "test-tablet-id";
		currentTabletName.value = tabletName;
		isTabletAuthenticated.value = true;
		
		localStorage.setItem("tabletId", "test-tablet-id");
		localStorage.setItem("tabletName", tabletName);
		localStorage.setItem("tabletAuth", "true");
	}
	
	function selectTablet(tabletId) {
		selectedTabletId.value = tabletId;
	}
	
	function sendPlayersToTablet(players, activityType) {
		if (!isConnected.value || !selectedTabletId.value) {
			console.warn("Cannot send players to tablet: not connected or no tablet selected");
			return false;
		}
		
		console.log("Sending players to tablet:", selectedTabletId.value);
		return sendMessage("send-players", {
			tabletId: selectedTabletId.value,
			players,
			activityType,
		});
	}
	
	function disconnectTablet() {
		console.log("Disconnecting tablet");
		
		if (wsInitialized.value && status.value !== "CLOSED") {
			try {
				closeConnection();
			} catch (error) {
				console.error("Error closing WebSocket:", error);
			}
		}
		
		wsInitialized.value = false;
		currentTabletId.value = null;
		currentTabletName.value = null;
		isTabletAuthenticated.value = false;
		
		localStorage.removeItem("tabletId");
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
		tablets,
		selectedTabletId,
		currentTabletId,
		currentTabletName,
		isTabletAuthenticated,
		isConnected,
		on,
		off,
		sendMessage,
		initSocket,
		registerTablet,
		manualAuthenticate,
		selectTablet,
		sendPlayersToTablet,
		disconnectTablet,
	};
}, {
	persist: true,
});
