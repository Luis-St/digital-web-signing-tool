import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const usePlayersStore = defineStore("players", () => {
	const players = ref([]);
	const currentPlayerIndex = ref(-1);
	const activityType = ref("laser-tag"); // or 'escape-room'
	
	const currentPlayer = computed(() => {
		if (currentPlayerIndex.value >= 0 && currentPlayerIndex.value < players.value.length) {
			return players.value[currentPlayerIndex.value];
		}
		return null;
	});
	
	const allSigned = computed(() => {
		return players.value.every(player => player.signed);
	});
	
	function setPlayers(playersList) {
		players.value = playersList.map(name => ({
			name,
			signed: false,
			signatureData: null,
			timestamp: null,
		}));
		currentPlayerIndex.value = players.value.length > 0 ? 0 : -1;
	}
	
	function setActivityType(type) {
		activityType.value = type;
	}
	
	function markCurrentPlayerSigned(signatureData) {
		if (currentPlayer.value) {
			currentPlayer.value.signed = true;
			currentPlayer.value.signatureData = signatureData;
			currentPlayer.value.timestamp = new Date().toISOString();
			
			// Move to next player
			if (currentPlayerIndex.value < players.value.length - 1) {
				currentPlayerIndex.value++;
			}
		}
	}
	
	function resetPlayers() {
		players.value = [];
		currentPlayerIndex.value = -1;
	}
	
	return {
		players,
		currentPlayerIndex,
		activityType,
		currentPlayer,
		allSigned,
		setPlayers,
		setActivityType,
		markCurrentPlayerSigned,
		resetPlayers,
	};
});
