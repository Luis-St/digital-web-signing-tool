<template>
	<div class="min-h-screen flex flex-col">
		<!-- Debug info - remove in production -->
		<div v-if="showDebug" class="bg-yellow-100 p-2 text-xs border-b">
			<p>Admin view debug info:</p>
			<p>Connection status: {{ connectionStatus }}
				<span v-if="!isConnected" class="text-red-500 ml-2">{{ connectionStatusDetails }}</span>
			</p>
			<p>Connected tablets: {{ tablets.length }}</p>
			<p>Selected tablet: {{ selectedTabletName || "None" }}</p>
			<div class="flex space-x-2 mt-1">
				<button class="text-blue-500 underline" @click="showDebug = false">Hide</button>
				<button class="text-green-500 underline" @click="refreshTabletsList">Refresh Tablets</button>
				<button class="text-purple-500 underline" @click="forceRefresh">Force Reconnect</button>
			</div>
		</div>

		<header class="bg-primary text-white p-4 shadow-md">
			<div class="container mx-auto flex justify-between items-center">
				<h1 class="text-xl font-bold">Waiver System - Admin</h1>
				<div class="flex items-center">
					<span :class="isConnected ? 'text-green-200' : 'text-red-200'" class="mr-4 text-sm">
						{{ isConnected ? "Connected" : "Disconnected" }}
					</span>
					<button class="text-white hover:underline" @click="logout">Logout</button>
				</div>
			</div>
		</header>

		<main class="flex-grow container mx-auto p-6">
			<div class="flex flex-col lg:flex-row gap-8 h-full">
				<!-- Player Form Section -->
				<div class="card lg:w-1/3">
					<h2 class="text-2xl font-semibold mb-6">Activity Setup</h2>

					<div class="mb-8">
						<label class="block text-lg font-medium text-gray-700 mb-3">Activity Type</label>
						<div class="flex flex-col space-y-3">
							<label :class="{'bg-primary/10 border-primary': activityType === 'laser-tag', 'border-gray-200': activityType !== 'laser-tag'}"
								   class="inline-flex items-center p-3 border rounded-lg cursor-pointer transition-colors duration-200 hover:bg-gray-50">
								<input
										v-model="activityType"
										class="form-radio"
										type="radio"
										value="laser-tag"
								/>
								<span class="ml-3 font-medium">Laser Tag</span>
							</label>
							<label :class="{'bg-primary/10 border-primary': activityType === 'escape-room', 'border-gray-200': activityType !== 'escape-room'}"
								   class="inline-flex items-center p-3 border rounded-lg cursor-pointer transition-colors duration-200 hover:bg-gray-50">
								<input
										v-model="activityType"
										class="form-radio"
										type="radio"
										value="escape-room"
								/>
								<span class="ml-3 font-medium">Escape Room</span>
							</label>
						</div>
					</div>

					<div class="mb-8">
						<label class="block text-lg font-medium text-gray-700 mb-3" for="playerCount">
							Number of Players
						</label>
						<div class="flex items-center">
							<button
									:disabled="playerCount <= 1"
									class="bg-gray-200 hover:bg-gray-300 text-gray-700 h-12 w-12 flex items-center justify-center rounded-l-lg text-2xl"
									@click="decrementCount"
							>
								-
							</button>
							<input
									id="playerCount"
									v-model.number="playerCount"
									class="input h-12 w-20 text-center text-xl font-semibold rounded-none"
									max="20"
									min="1"
									type="number"
							/>
							<button
									:disabled="playerCount >= 20"
									class="bg-gray-200 hover:bg-gray-300 text-gray-700 h-12 w-12 flex items-center justify-center rounded-r-lg text-2xl"
									@click="incrementCount"
							>
								+
							</button>
						</div>
					</div>

					<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
						<p class="text-blue-700">
							<strong>Note:</strong> Player names will be entered on the tablet.
						</p>
					</div>

					<div class="mt-6">
						<button
								:class="{'opacity-50 cursor-not-allowed': !canSendToTablet}"
								:disabled="!canSendToTablet"
								class="btn-primary w-full py-3 text-lg"
								@click="sendToTablet"
						>
							Send to Selected Tablet
						</button>
					</div>
				</div>

				<!-- Tablet Selection Section -->
				<div class="card lg:flex-1">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-2xl font-semibold">Available Tablets</h2>
						<button
								class="btn flex items-center"
								@click="refreshTabletsList"
						>
							<svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
								<path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
							</svg>
							Refresh List
						</button>
					</div>

					<div v-if="!isConnected" class="bg-red-50 text-red-700 p-5 rounded-lg mb-6 text-center">
						<svg class="h-12 w-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
						</svg>
						<p class="text-lg mb-3">Not connected to server</p>
						<button class="btn-primary" @click="adminStore.initWebSocket()">Try to reconnect</button>
					</div>

					<div v-else-if="tablets.length === 0" class="flex flex-col items-center justify-center p-12 text-center">
						<svg class="h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
						</svg>
						<p class="text-gray-500 text-lg mb-4">No tablets connected</p>
						<p class="text-gray-400">Please register a tablet and refresh the list</p>
					</div>

					<div v-else class="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
						<div
								v-for="tablet in tablets"
								:key="tablet.name"
								:class="{
									'bg-primary/10 border-primary shadow': selectedTabletName === tablet.name,
									'hover:bg-gray-50': selectedTabletName !== tablet.name
								}"
								class="p-4 border rounded-lg cursor-pointer transition-colors duration-200 flex flex-col"
								@click="selectTablet(tablet.name)"
						>
							<div class="flex justify-between items-center mb-3">
								<h3 class="font-semibold text-lg">{{ tablet.name }}</h3>
								<span
										:class="{
										'bg-orange-100 text-orange-800': tablet.status === 'busy',
										'bg-green-100 text-green-800': tablet.status === 'available'
									}"
										class="px-3 py-1 rounded-full text-sm font-medium"
								>
									{{ tablet.status === "busy" ? "Busy" : "Available" }}
								</span>
							</div>
							<div class="text-sm text-gray-500">
								<p v-if="tablet.players && tablet.players.length">
									Players: {{ tablet.players.length }}
								</p>
								<p v-else class="text-sm text-gray-400">
									No active players
								</p>
							</div>
							<div v-if="selectedTabletName === tablet.name" class="mt-3 pt-3 border-t border-primary/30">
								<p class="text-primary font-medium">Selected</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAdminStore } from "@/stores/admin";
import { usePlayersStore } from "@/stores/players";

const router = useRouter();
const adminStore = useAdminStore();
const playersStore = usePlayersStore();

// Debug settings
const showDebug = ref(true); // Set to false for production

// Make sure we're authenticated
onMounted(() => {
	console.log("AdminView mounted, auth state:", adminStore.isAuthenticated);
	if (!adminStore.isAuthenticated) {
		router.push("/admin/login");
		return;
	}

	// Initialize other required data
	initData();
});

// Player form state
const playerCount = ref(1);
const activityType = ref("laser-tag");

// Tablets data is now directly from the admin store
const selectedTabletName = computed(() => adminStore.selectedTabletName);

// WebSocket connection status
const isConnected = computed(() => adminStore.isConnected);
const connectionStatus = computed(() => {
	if (isConnected.value) return "Connected";
	return "Disconnected";
});
const connectionStatusDetails = ref("");

// Computed properties
const canSendToTablet = computed(() => {
	// Added check for tablet status not being "busy"
	return selectedTabletName.value &&
		playerCount.value > 0 &&
		isConnected.value &&
		(adminStore.selectedTablet && adminStore.selectedTablet.status !== "busy");
});

const tablets = computed(() => {
	return adminStore.tablets.filter(tablet => tablet.connected !== false);
});

// Initialize required data
function initData() {
	// Connection is now managed by the admin store
	adminStore.initWebSocket();

	// Refresh tablets list
	refreshTabletsList();

	// Set up periodic connection checker and tablet refresher
	const connectionChecker = setInterval(() => {
		if (!isConnected.value) {
			connectionStatusDetails.value = "Connection lost, attempting to reconnect...";
			adminStore.initWebSocket();
		} else {
			connectionStatusDetails.value = "";
			// Refresh tablets list every 30 seconds if connected
			refreshTabletsList();
		}
	}, 30000); // Check every 30 seconds

	// Clean up on component unmount
	onUnmounted(() => {
		clearInterval(connectionChecker);
	});
}

// Methods
function logout() {
	adminStore.logout();
	router.push("/admin/login");
}

function refreshTabletsList() {
	console.log("Refreshing tablets list");
	if (isConnected.value) {
		adminStore.refreshTablets();
	} else {
		connectionStatusDetails.value = "Not connected. Cannot refresh.";
		// Try to reconnect
		adminStore.initWebSocket();
	}
}

function forceRefresh() {
	// This forces a refresh even if the UI thinks we're disconnected
	adminStore.initWebSocket();
	setTimeout(() => {
		adminStore.refreshTablets();
	}, 1000);
}

function selectTablet(tabletName) {
	adminStore.selectTablet(tabletName);
}

function sendToTablet() {
	if (!canSendToTablet.value) return;

	// Now just sending player count and activity type
	adminStore.sendPlayersToTablet(playerCount.value, activityType.value);

	// Clear the player form after sending
	playerCount.value = 1;
}

function incrementCount() {
	if (playerCount.value < 20) {
		playerCount.value++;
	}
}

function decrementCount() {
	if (playerCount.value > 1) {
		playerCount.value--;
	}
}

// Watch for connection changes
watch(() => adminStore.isConnected, (newValue) => {
	console.log("Connection status changed:", newValue ? "connected" : "disconnected");

	if (newValue) {
		connectionStatusDetails.value = "";
		// Refresh tablets list when connection is established
		refreshTabletsList();
	} else {
		connectionStatusDetails.value = "Connection lost";
	}
});
</script>
