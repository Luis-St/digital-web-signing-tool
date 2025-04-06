import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import { useAdminStore } from './stores/admin'

// Import Tailwind CSS
import './assets/tailwind.css'

// Create and configure Pinia with persistence
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// Create Vue app
const app = createApp(App)

// Use plugins
app.use(pinia)
app.use(router)

// Mount app
app.mount('#app')

// Add some debugging to help troubleshoot
console.log('Environment variables loaded:', !!import.meta.env.VITE_ADMIN_USERNAME)

// Initialize the admin store to ensure reactivity works
const adminStore = useAdminStore()
console.log('Initial authentication state:', adminStore.isAuthenticated)