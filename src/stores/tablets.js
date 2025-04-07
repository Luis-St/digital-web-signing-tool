import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { io } from "socket.io-client";

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
	const socket = ref(null);
	
	const selectedTablet = computed(() => {
		return tablets.value.find(tablet => tablet.id === selectedTabletId.value);
	});
	
	function initSocket() {
		if (socket.value && socket.value.connected) return;
		
		console.log("Initializing socket connection");
		const socketUrl = import.meta.env.VITE_SOCKET_URL || "ws://localhost:5000";
		console.log("Socket URL:", socketUrl);
		
		try {
			socket.value = io(socketUrl);
			
			socket.value.on("connect", () => {
				console.log("Connected to server");
				
				// If we have a stored tablet ID, try to re-register with the server
				if (isTabletAuthenticated.value && currentTabletId.value && currentTabletName.value) {
					console.log("Attempting to reconnect tablet:", currentTabletName.value);
					socket.value.emit("register-tablet", { tabletName: currentTabletName.value });
				}
			});
			
			socket.value.on("tablets-update", (connectedTablets) => {
				console.log("Received tablets update:", connectedTablets);
				tablets.value = connectedTablets;
			});
			
			socket.value.on("disconnect", () => {
				console.log("Disconnected from server");
			});
			
			socket.value.on("connect_error", (error) => {
				console.error("Socket connection error:", error);
			});
		} catch (error) {
			console.error("Failed to initialize socket:", error);
		}
	}
	
	function registerTablet(tabletName, token) {
		console.log("Registering tablet:", tabletName);
		
		if (!socket.value) {
			console.log("No socket connection, initializing...");
			initSocket();
		}
		
		// Verify token immediately
		const validToken = import.meta.env.VITE_TABLET_TOKEN;
		console.log("Token valid:", token === validToken);
		
		if (token !== validToken) {
			console.error("Invalid tablet token");
			return Promise.reject(new Error("Invalid tablet token"));
		}
		
		return new Promise((resolve, reject) => {
			if (!socket.value || !socket.value.connected) {
				console.error("Socket not connected");
				reject(new Error("Server connection failed. Please try again."));
				return;
			}
			
			socket.value.emit("register-tablet", { tabletName }, (response) => {
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
			
			// Add a timeout in case the server doesn't respond
			setTimeout(() => {
				if (!isTabletAuthenticated.value) {
					console.error("Tablet registration timed out");
					reject(new Error("Server did not respond. Please try again."));
				}
			}, 5000);
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
		if (!socket.value || !selectedTabletId.value) return;
		
		console.log("Sending players to tablet:", selectedTabletId.value);
		socket.value.emit("send-players", {
			tabletId: selectedTabletId.value,
			players,
			activityType,
		});
	}
	
	function disconnectTablet() {
		console.log("Disconnecting tablet");
		
		if (socket.value) {
			socket.value.disconnect();
			socket.value = null;
		}
		
		currentTabletId.value = null;
		currentTabletName.value = null;
		isTabletAuthenticated.value = false;
		
		localStorage.removeItem("tabletId");
		localStorage.removeItem("tabletName");
		localStorage.removeItem("tabletAuth");
	}
	
	return {
		tablets,
		selectedTabletId,
		currentTabletId,
		currentTabletName,
		isTabletAuthenticated,
		selectedTablet,
		initSocket,
		registerTablet,
		manualAuthenticate, // Added for testing
		selectTablet,
		sendPlayersToTablet,
		disconnectTablet,
	};
}, {
	persist: true,
});
