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
const playerCount = ref(0);
const playerFields = ref([]);
const activityType = ref("laser-tag");

// Tablets data is now directly from the admin store
const selectedTabletId = computed(() => adminStore.selectedTabletId);

// WebSocket connection status
const isConnected = computed(() => adminStore.isConnected);
const connectionStatus = computed(() => {
	if (isConnected.value) return "Connected";
	return "Disconnected";
});
const connectionStatusDetails = ref("");

// Mock recent waivers data (would come from API in real app)
const recentWaivers = ref([
	{
		id: 1,
		date: new Date(2025, 3, 1),
		playerName: "John Doe",
		activity: "Laser Tag",
	},
	{
		id: 2,
		date: new Date(2025, 3, 1),
		playerName: "Jane Smith",
		activity: "Escape Room",
	},
]);

// Computed properties
const canSendToTablet = computed(() => {
	return selectedTabletId.value &&
		playerFields.value.length > 0 &&
		playerFields.value.every(p => p.name && p.name.trim() !== "") &&
		isConnected.value;
});

const tablets = computed(() => {
	return adminStore.tablets;
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

function selectTablet(tabletId) {
	adminStore.selectTablet(tabletId);
}

function sendToTablet() {
	if (!canSendToTablet.value) return;

	const playerNames = playerFields.value.map(p => p.name.trim());
	playersStore.setPlayers(playerNames);
	playersStore.setActivityType(activityType.value);

	adminStore.sendPlayersToTablet(playerNames, activityType.value);

	// Clear the player form after sending
	playerCount.value = 0;
	playerFields.value = [];
}

function formatDate(date) {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

// Watch for changes in playerCount to update playerFields array
watch(playerCount, (newCount) => {
	if (newCount > playerFields.value.length) {
		// Add new player fields
		for (let i = playerFields.value.length; i < newCount; i++) {
			playerFields.value.push({ name: "" });
		}
	} else if (newCount < playerFields.value.length) {
		// Remove excess player fields
		playerFields.value = playerFields.value.slice(0, newCount);
	}
});

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

<template>
	<div class="min-h-screen flex flex-col">
		<!-- Debug info - remove in production -->
		<div v-if="showDebug" class="bg-yellow-100 p-2 text-xs border-b">
			<p>Admin view debug info:</p>
			<p>Connection status: {{ connectionStatus }}
				<span v-if="!isConnected" class="text-red-500 ml-2">{{ connectionStatusDetails }}</span>
			</p>
			<p>Connected tablets: {{ tablets.length }}</p>
			<p>Selected tablet: {{ selectedTabletId || "None" }}</p>
			<div class="flex space-x-2 mt-1">
				<button @click="showDebug = false" class="text-blue-500 underline">Hide</button>
				<button @click="refreshTabletsList" class="text-green-500 underline">Refresh Tablets</button>
				<button @click="forceRefresh" class="text-purple-500 underline">Force Reconnect</button>
			</div>
		</div>

		<header class="bg-primary text-white p-4 shadow-md">
			<div class="container mx-auto flex justify-between items-center">
				<h1 class="text-xl font-bold">Waiver System - Admin</h1>
				<div class="flex items-center">
					<span class="mr-4 text-sm" :class="isConnected ? 'text-green-200' : 'text-red-200'">
						{{ isConnected ? "Connected" : "Disconnected" }}
					</span>
					<button @click="logout" class="text-white hover:underline">Logout</button>
				</div>
			</div>
		</header>

		<main class="flex-grow container mx-auto p-4">
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Player Form Section -->
				<div class="card">
					<h2 class="text-xl font-semibold mb-4">Player Information</h2>

					<div class="mb-4">
						<label class="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
						<div class="flex space-x-4">
							<label class="inline-flex items-center">
								<input
										type="radio"
										v-model="activityType"
										value="laser-tag"
										class="form-radio"
								/>
								<span class="ml-2">Laser Tag</span>
							</label>
							<label class="inline-flex items-center">
								<input
										type="radio"
										v-model="activityType"
										value="escape-room"
										class="form-radio"
								/>
								<span class="ml-2">Escape Room</span>
							</label>
						</div>
					</div>

					<div class="mb-4">
						<label for="playerCount" class="block text-sm font-medium text-gray-700 mb-1">
							Number of Players
						</label>
						<input
								id="playerCount"
								v-model.number="playerCount"
								type="number"
								min="1"
								max="20"
								class="input w-full"
						/>
					</div>

					<div v-if="playerCount > 0" class="space-y-3 mb-4">
						<div v-for="(player, index) in playerFields" :key="index" class="flex space-x-2">
							<input
									v-model="player.name"
									:placeholder="'Player ' + (index + 1)"
									class="input flex-grow"
							/>
						</div>
					</div>
				</div>

				<!-- Tablet Selection Section -->
				<div class="card">
					<div class="flex justify-between items-center mb-4">
						<h2 class="text-xl font-semibold">Tablet Selection</h2>
						<button
								@click="refreshTabletsList"
								class="text-primary hover:underline flex items-center"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
							</svg>
							Refresh
						</button>
					</div>

					<div v-if="!isConnected" class="bg-red-50 text-red-700 p-3 rounded mb-4">
						Not connected to server.
						<button @click="adminStore.initWebSocket()" class="underline ml-1">Try to reconnect</button>
					</div>

					<div v-else-if="tablets.length === 0" class="text-gray-500">
						No tablets connected. Please connect a tablet and refresh.
					</div>

					<div v-else class="space-y-2 mb-4">
						<div
								v-for="tablet in tablets"
								:key="tablet.id"
								@click="selectTablet(tablet.id)"
								class="p-3 border rounded cursor-pointer flex justify-between items-center"
								:class="{'bg-primary/10 border-primary': selectedTabletId === tablet.id}"
						>
							<span>
								{{ tablet.name }}
							</span>
							<span v-if="tablet.status === 'busy'" class="text-sm text-orange-500">
                				Busy
							</span>
							<span v-else class="text-sm text-green-500">
                				Available
              				</span>
						</div>
					</div>

					<div class="mt-6 flex justify-end">
						<button
								@click="sendToTablet"
								class="btn-primary"
								:disabled="!canSendToTablet"
								:class="{'opacity-50 cursor-not-allowed': !canSendToTablet}"
						>
							Send to Tablet
						</button>
					</div>
				</div>
			</div>

			<!-- Recent Waivers Section -->
			<div class="card mt-6">
				<h2 class="text-xl font-semibold mb-4">Recent Waivers</h2>

				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead>
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Date
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Player Name
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Activity
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Actions
							</th>
						</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
						<!-- This would be populated from your backend -->
						<tr v-if="recentWaivers.length === 0">
							<td colspan="4" class="px-6 py-4 text-center text-gray-500">
								No recent waivers found
							</td>
						</tr>
						<tr v-for="waiver in recentWaivers" :key="waiver.id">
							<td class="px-6 py-4 whitespace-nowrap">
								{{ formatDate(waiver.date) }}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{{ waiver.playerName }}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{{ waiver.activity }}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<button class="text-primary hover:underline">View</button>
							</td>
						</tr>
						</tbody>
					</table>
				</div>
			</div>
		</main>
	</div>
</template>
