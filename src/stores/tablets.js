import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { io } from "socket.io-client";

export const useTabletsStore = defineStore("tablets", () => {
	const tablets = ref([]);
	const selectedTabletId = ref(null);
	const currentTabletId = ref(null);
	const isTabletAuthenticated = ref(false);
	const socket = ref(null);
	
	const selectedTablet = computed(() => {
		return tablets.value.find(tablet => tablet.id === selectedTabletId.value);
	});
	
	function initSocket() {
		if (socket.value && socket.value.connected) return;
		
		socket.value = io(import.meta.env.VITE_SOCKET_URL);
		
		socket.value.on("connect", () => {
			console.log("Connected to server");
		});
		
		socket.value.on("tablets-update", (connectedTablets) => {
			tablets.value = connectedTablets;
		});
		
		socket.value.on("disconnect", () => {
			console.log("Disconnected from server");
		});
	}
	
	function registerTablet(tabletName, token) {
		if (!socket.value) initSocket();
		
		return new Promise((resolve, reject) => {
			if (token !== import.meta.env.VITE_TABLET_TOKEN) {
				reject(new Error("Invalid tablet token"));
				return;
			}
			
			socket.value.emit("register-tablet", { tabletName }, (response) => {
				if (response.success) {
					currentTabletId.value = response.tabletId;
					isTabletAuthenticated.value = true;
					resolve(response);
				} else {
					reject(new Error(response.message || "Failed to register tablet"));
				}
			});
		});
	}
	
	function selectTablet(tabletId) {
		selectedTabletId.value = tabletId;
	}
	
	function sendPlayersToTablet(players, activityType) {
		if (!socket.value || !selectedTabletId.value) return;
		
		socket.value.emit("send-players", {
			tabletId: selectedTabletId.value,
			players,
			activityType,
		});
	}
	
	function disconnectTablet() {
		if (socket.value) {
			socket.value.disconnect();
			socket.value = null;
		}
		
		currentTabletId.value = null;
		isTabletAuthenticated.value = false;
	}
	
	return {
		tablets,
		selectedTabletId,
		currentTabletId,
		isTabletAuthenticated,
		selectedTablet,
		initSocket,
		registerTablet,
		selectTablet,
		sendPlayersToTablet,
		disconnectTablet,
	};
});
