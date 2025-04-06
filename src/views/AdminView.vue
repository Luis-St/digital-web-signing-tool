<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAdminStore } from "@/stores/admin";
import { useTabletsStore } from "@/stores/tablets";
import { usePlayersStore } from "@/stores/players";

const router = useRouter();
const adminStore = useAdminStore();
const tabletsStore = useTabletsStore();
const playersStore = usePlayersStore();

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

// Tablets data
const tablets = ref([]);
const selectedTabletId = ref(null);

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
		playerFields.value.every(p => p.name && p.name.trim() !== "");
});

// Initialize required data
function initData() {
	// Initialize the socket connection
	tabletsStore.initSocket();

	// Set up watchers to track tablets from the store
	watch(() => tabletsStore.tablets, (newTablets) => {
		tablets.value = newTablets;
	}, { immediate: true });
}

// Methods
function logout() {
	adminStore.logout();
	router.push("/admin/login");
}

function selectTablet(tabletId) {
	selectedTabletId.value = tabletId;
	tabletsStore.selectTablet(tabletId);
}

function sendToTablet() {
	if (!canSendToTablet.value) return;

	const playerNames = playerFields.value.map(p => p.name.trim());
	playersStore.setPlayers(playerNames);
	playersStore.setActivityType(activityType.value);

	tabletsStore.sendPlayersToTablet(playerNames, activityType.value);
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
</script>

<template>
	<div class="min-h-screen flex flex-col">
		<header class="bg-primary text-white p-4 shadow-md">
			<div class="container mx-auto flex justify-between items-center">
				<h1 class="text-xl font-bold">Waiver System - Admin</h1>
				<button @click="logout" class="text-white hover:underline">Logout</button>
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
					<h2 class="text-xl font-semibold mb-4">Tablet Selection</h2>

					<div v-if="tablets.length === 0" class="text-gray-500">
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
							<span>{{ tablet.name }}</span>
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