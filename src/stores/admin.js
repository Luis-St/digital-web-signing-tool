import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAdminStore = defineStore('admin', () => {
	// Use localStorage to persist authentication state across page refreshes
	const storedAuth = localStorage.getItem('adminAuth') === 'true'
	const storedUsername = localStorage.getItem('adminUsername') || ''
	
	const isAuthenticated = ref(storedAuth)
	const username = ref(storedUsername)
	
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
			
			console.log('Login successful')
			return true
		}
		
		console.log('Login failed')
		return false
	}
	
	function logout() {
		isAuthenticated.value = false
		username.value = ''
		
		// Clear localStorage
		localStorage.removeItem('adminAuth')
		localStorage.removeItem('adminUsername')
	}
	
	return {
		isAuthenticated,
		username,
		login,
		logout
	}
}, {
	// Enable this if you want to persist the entire store to localStorage
	persist: true
})