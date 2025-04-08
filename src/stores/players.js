import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const usePlayersStore = defineStore("players", () => {
	// Use sessionStorage instead of localStorage to ensure data is cleared when session ends
	const getStoredPlayers = () => {
		try {
			return sessionStorage.getItem("players")
				? JSON.parse(sessionStorage.getItem("players"))
				: [];
		} catch (e) {
			console.error("Error parsing stored players:", e);
			return [];
		}
	};
	
	const getStoredActivity = () => {
		return sessionStorage.getItem("activityType") || "laser-tag";
	};
	
	const players = ref(getStoredPlayers());
	const selectedPlayerIndex = ref(-1); // Index of the currently selected player
	const activityType = ref(getStoredActivity());
	
	const selectedPlayer = computed(() => {
		if (selectedPlayerIndex.value >= 0 && selectedPlayerIndex.value < players.value.length) {
			return players.value[selectedPlayerIndex.value];
		}
		return null;
	});
	
	const allSigned = computed(() => {
		return players.value.length > 0 && players.value.every(player => player.signed);
	});
	
	const pendingPlayers = computed(() => {
		return players.value.filter(player => !player.signed);
	});
	
	const signedPlayers = computed(() => {
		return players.value.filter(player => player.signed);
	});
	
	function setPlayers(playersList) {
		console.log("Setting players:", playersList);
		
		players.value = playersList.map(name => ({
			name,
			signed: false,
			signatureData: null,
			timestamp: null,
		}));
		
		// Set the first player as selected by default if available
		selectedPlayerIndex.value = players.value.length > 0 ? 0 : -1;
		
		// Store in sessionStorage
		updateSessionStorage();
		
		console.log("Players set, current index:", selectedPlayerIndex.value);
	}
	
	function setActivityType(type) {
		console.log("Setting activity type:", type);
		activityType.value = type;
		sessionStorage.setItem("activityType", type);
	}
	
	function selectPlayer(index) {
		if (index >= 0 && index < players.value.length) {
			selectedPlayerIndex.value = index;
			console.log("Selected player index:", index);
			return true;
		}
		return false;
	}
	
	function selectPlayerByName(name) {
		const index = players.value.findIndex(player => player.name === name);
		return selectPlayer(index);
	}
	
	function markSelectedPlayerSigned(signatureData) {
		console.log("Marking selected player signed");
		
		if (selectedPlayer.value) {
			selectedPlayer.value.signed = true;
			selectedPlayer.value.signatureData = signatureData;
			selectedPlayer.value.timestamp = new Date().toISOString();
			
			// Update sessionStorage
			updateSessionStorage();
			
			// Try to select the next unsigned player if any
			selectNextUnsignedPlayer();
			
			return true;
		}
		
		return false;
	}
	
	function resetPlayerSignature(index) {
		if (index >= 0 && index < players.value.length) {
			players.value[index].signed = false;
			players.value[index].signatureData = null;
			players.value[index].timestamp = null;
			
			// Update sessionStorage
			updateSessionStorage();
			
			return true;
		}
		
		return false;
	}
	
	function selectNextUnsignedPlayer() {
		// Find the next unsigned player
		const nextUnsignedIndex = players.value.findIndex(player => !player.signed);
		
		if (nextUnsignedIndex !== -1) {
			selectedPlayerIndex.value = nextUnsignedIndex;
			return true;
		}
		
		// If all players are signed, keep the current selection
		return false;
	}
	
	function updateSessionStorage() {
		sessionStorage.setItem("players", JSON.stringify(players.value));
	}
	
	function resetPlayers() {
		console.log("Resetting players");
		
		players.value = [];
		selectedPlayerIndex.value = -1;
		
		// Clear sessionStorage
		sessionStorage.removeItem("players");
	}
	
	return {
		players,
		selectedPlayerIndex,
		activityType,
		selectedPlayer,
		allSigned,
		pendingPlayers,
		signedPlayers,
		setPlayers,
		setActivityType,
		selectPlayer,
		selectPlayerByName,
		markSelectedPlayerSigned,
		resetPlayerSignature,
		selectNextUnsignedPlayer,
		resetPlayers,
	};
}, {
	// Do not persist to localStorage - use sessionStorage for temporary persistence
	persist: false,
});
