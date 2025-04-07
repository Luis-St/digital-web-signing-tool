import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePlayersStore = defineStore('players', () => {
	// Retrieve stored players from localStorage if available
	const storedPlayers = localStorage.getItem('players')
		? JSON.parse(localStorage.getItem('players'))
		: []
	
	const storedIndex = localStorage.getItem('currentPlayerIndex')
		? parseInt(localStorage.getItem('currentPlayerIndex'))
		: -1
	
	const storedActivity = localStorage.getItem('activityType') || 'laser-tag'
	
	const players = ref(storedPlayers)
	const currentPlayerIndex = ref(storedIndex)
	const activityType = ref(storedActivity)
	
	const currentPlayer = computed(() => {
		if (currentPlayerIndex.value >= 0 && currentPlayerIndex.value < players.value.length) {
			return players.value[currentPlayerIndex.value]
		}
		return null
	})
	
	const allSigned = computed(() => {
		return players.value.length > 0 && players.value.every(player => player.signed)
	})
	
	function setPlayers(playersList) {
		console.log('Setting players:', playersList)
		
		players.value = playersList.map(name => ({
			name,
			signed: false,
			signatureData: null,
			timestamp: null
		}))
		
		currentPlayerIndex.value = players.value.length > 0 ? 0 : -1
		
		// Store in localStorage
		localStorage.setItem('players', JSON.stringify(players.value))
		localStorage.setItem('currentPlayerIndex', currentPlayerIndex.value.toString())
		
		console.log('Players set, current index:', currentPlayerIndex.value)
	}
	
	function setActivityType(type) {
		console.log('Setting activity type:', type)
		activityType.value = type
		localStorage.setItem('activityType', type)
	}
	
	function markCurrentPlayerSigned(signatureData) {
		console.log('Marking current player signed')
		
		if (currentPlayer.value) {
			currentPlayer.value.signed = true
			currentPlayer.value.signatureData = signatureData
			currentPlayer.value.timestamp = new Date().toISOString()
			
			// Move to next player
			if (currentPlayerIndex.value < players.value.length - 1) {
				currentPlayerIndex.value++
			}
			
			// Update localStorage
			localStorage.setItem('players', JSON.stringify(players.value))
			localStorage.setItem('currentPlayerIndex', currentPlayerIndex.value.toString())
			
			console.log('Player marked as signed, new index:', currentPlayerIndex.value)
		}
	}
	
	function resetPlayers() {
		console.log('Resetting players')
		
		players.value = []
		currentPlayerIndex.value = -1
		
		// Clear localStorage
		localStorage.removeItem('players')
		localStorage.removeItem('currentPlayerIndex')
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
		resetPlayers
	}
}, {
	persist: true
})
