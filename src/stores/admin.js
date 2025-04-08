import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useWebSocket } from '@vueuse/core'

export const useAdminStore = defineStore('admin', () => {
	// Use localStorage to persist authentication state across page refreshes
	const storedAuth = localStorage.getItem('adminAuth') === 'true'
	const storedUsername = localStorage.getItem('adminUsername') || ''
	
	const isAuthenticated = ref(storedAuth)
	const username = ref(storedUsername)
	
	// WebSocket connection state
	const tablets = ref([])
	const wsInitialized = ref(false)
	const selectedTabletId = ref(null)
	
	// WebSocket connection using VueUse
	const socketUrl = computed(() => import.meta.env.VITE_SOCKET_URL || "ws://localhost:5000")
	
	// Event handlers
	const eventHandlers = ref(new Map())
	
	// Callback tracking
	const pendingCallbacks = ref(new Map())
	let callbackCounter = 0
	
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
				console.error("Failed to connect WebSocket after multiple retries")
			},
		},
		heartbeat: {
			message: JSON.stringify({ type: "ping" }),
			interval: 30000,
		},
		autoClose: false, // Don't auto-close on component unmount
		immediate: false, // Don't connect immediately
		onConnected() {
			console.log("Admin WebSocket connected")
			
			// Request current tablets list when connected
			sendMessage("get-tablets", {})
		},
		onDisconnected() {
			console.log("Admin WebSocket disconnected")
		},
		onError(err) {
			console.error("Admin WebSocket error:", err)
		},
		onMessage(ws, event) {
			try {
				const message = JSON.parse(event.data)
				console.log("Admin WebSocket message received:", message)
				
				if (message.type === "event") {
					// Special case for tablets-update event
					if (message.event === "tablets-update" && message.data) {
						console.log("Received tablets update:", message.data)
						tablets.value = message.data
					}
					
					// Handle registered event handlers
					const handlers = eventHandlers.value.get(message.event) || []
					handlers.forEach(handler => handler(message.data))
				} else if (message.type === "callback" && message.id) {
					// Handle callback
					const callback = pendingCallbacks.value.get(message.id)
					if (callback) {
						callback(message.data)
						pendingCallbacks.value.delete(message.id)
					}
				}
			} catch (error) {
				console.error("Error processing WebSocket message:", error)
			}
		},
	})
	
	// Computed property for connection status
	const isConnected = computed(() => status.value === "OPEN")
	
	// Initialize WebSocket connection
	function initWebSocket() {
		console.log("Initializing Admin WebSocket connection")
		
		// Only open if not already connected
		if (status.value !== "OPEN") {
			openConnection()
			wsInitialized.value = true
		} else {
			console.log("Admin WebSocket already connected")
			
			// Request tablet update even if already connected
			sendMessage("get-tablets", {})
		}
	}
	
	// Register event handler
	function on(event, handler) {
		if (!eventHandlers.value.has(event)) {
			eventHandlers.value.set(event, [])
		}
		eventHandlers.value.get(event).push(handler)
		
		console.log(`Registered admin handler for event: ${event}`)
	}
	
	// Remove event handler
	function off(event, handler) {
		if (!eventHandlers.value.has(event)) return
		
		if (handler) {
			const handlers = eventHandlers.value.get(event)
			const index = handlers.indexOf(handler)
			if (index !== -1) {
				handlers.splice(index, 1)
			}
		} else {
			eventHandlers.value.delete(event)
		}
		
		console.log(`Removed admin handler for event: ${event}`)
	}
	
	// Send message with optional callback
	function sendMessage(event, data, callback) {
		if (!isConnected.value) {
			console.warn("Cannot send message, Admin WebSocket not connected")
			return false
		}
		
		const message = {
			type: "event",
			event,
			data: {
				...data,
				isAdmin: true, // Add flag to indicate this is an admin client
			},
		}
		
		if (callback) {
			const id = `cb_${Date.now()}_${callbackCounter++}`
			message.id = id
			pendingCallbacks.value.set(id, callback)
			
			// Set timeout to clean up callback if no response
			setTimeout(() => {
				if (pendingCallbacks.value.has(id)) {
					console.warn(`Callback for event ${event} timed out`)
					pendingCallbacks.value.delete(id)
				}
			}, 10000)
		}
		
		console.log(`Admin sending message: ${event}`, message.data)
		sendRaw(JSON.stringify(message))
		return true
	}
	
	// Manually refresh tablets list
	function refreshTablets() {
		if (isConnected.value) {
			console.log("Admin manually refreshing tablets list")
			sendMessage("get-tablets", {})
		} else {
			console.warn("Cannot refresh tablets, Admin WebSocket not connected")
			// Try to reconnect
			initWebSocket()
		}
	}
	
	// Select a tablet
	function selectTablet(tabletId) {
		selectedTabletId.value = tabletId
		console.log("Admin selected tablet:", tabletId)
	}
	
	// Send players to tablet
	function sendPlayersToTablet(players, activityType) {
		if (!isConnected.value || !selectedTabletId.value) {
			console.warn("Cannot send players to tablet: not connected or no tablet selected")
			return false
		}
		
		console.log("Admin sending players to tablet:", selectedTabletId.value)
		return sendMessage("send-players", {
			tabletId: selectedTabletId.value,
			players,
			activityType,
		})
	}
	
	// Login function
	function login(enteredUsername, enteredPassword) {
		// In a real app, you'd call an API here
		// For now, we'll use environment variables for simplicity
		const validUsername = import.meta.env.VITE_ADMIN_USERNAME
		const validPassword = import.meta.env.VITE_ADMIN_PASSWORD
		
		console.log('Attempting login:', { enteredUsername })
		console.log('Expected:', { validUsername })
		
		if (enteredUsername === validUsername && enteredPassword === validPassword) {
			isAuthenticated.value = true
			username.value = enteredUsername
			
			// Store in localStorage for persistence
			localStorage.setItem('adminAuth', 'true')
			localStorage.setItem('adminUsername', enteredUsername)
			
			// Initialize WebSocket when authenticated
			initWebSocket()
			
			console.log('Login successful')
			return true
		}
		
		console.log('Login failed')
		return false
	}
	
	function logout() {
		isAuthenticated.value = false
		username.value = ''
		
		// Close WebSocket connection
		if (wsInitialized.value && status.value !== "CLOSED") {
			try {
				closeConnection()
				wsInitialized.value = false
			} catch (error) {
				console.error("Error closing WebSocket:", error)
			}
		}
		
		// Clear localStorage
		localStorage.removeItem('adminAuth')
		localStorage.removeItem('adminUsername')
	}
	
	// Initialize WebSocket connection if authenticated
	watch(isAuthenticated, (newValue) => {
		if (newValue && !wsInitialized.value) {
			initWebSocket()
		}
	}, { immediate: true })
	
	return {
		isAuthenticated,
		username,
		login,
		logout,
		
		// WebSocket related
		tablets,
		selectedTabletId,
		isConnected,
		initWebSocket,
		refreshTablets,
		selectTablet,
		sendPlayersToTablet,
		on,
		off,
	}
}, {
	persist: true
})
