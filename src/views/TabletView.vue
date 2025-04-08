<template>
	<div class="min-h-screen flex flex-col">
		<!-- Debug info - remove in production -->
		<div v-if="showDebug" class="bg-yellow-100 p-2 text-xs border-b">
			<p>Tablet state: {{ isTabletAuthenticated ? "Authenticated" : "Not authenticated" }}</p>
			<p>Tablet name: {{ tabletName }}</p>
			<p>Socket status: {{ connectionStatus }}
				<span v-if="!isConnected" class="text-red-500 ml-2">{{ connectionStatusDetails }}</span>
			</p>
			<div class="flex space-x-2 mt-1">
				<button @click="showDebug = false" class="text-blue-500 underline">Hide</button>
				<button v-if="!isTabletAuthenticated" @click="useTestMode" class="text-green-500 underline">Test Mode</button>
				<button v-if="isTabletAuthenticated" @click="resetTablet" class="text-red-500 underline">Reset</button>
				<button v-if="isTabletAuthenticated && !isConnected" @click="reconnect" class="text-blue-500 underline">Reconnect</button>
			</div>
		</div>

		<!-- Tablet Authentication -->
		<div v-if="!isTabletAuthenticated" class="flex-grow flex items-center justify-center p-4">
			<div class="card w-full max-w-md">
				<h1 class="text-2xl font-bold text-center text-primary mb-6">Tablet Registration</h1>

				<form @submit.prevent="handleRegisterTablet" class="space-y-4">
					<div>
						<label for="tabletName" class="block text-sm font-medium text-gray-700 mb-1">
							Tablet Name
						</label>
						<input
								id="tabletName"
								v-model="tabletName"
								type="text"
								class="input w-full"
								placeholder="e.g., Tablet 1"
								required
						/>
					</div>

					<div>
						<label for="tabletToken" class="block text-sm font-medium text-gray-700 mb-1">
							Validation Token
						</label>
						<input
								id="tabletToken"
								v-model="tabletToken"
								type="password"
								class="input w-full"
								required
						/>
					</div>

					<div v-if="registrationError" class="text-red-500 text-sm">
						{{ registrationError }}
					</div>

					<button type="submit" class="btn-primary w-full" :disabled="registrationInProgress">
						{{ registrationInProgress ? "Connecting..." : "Register Tablet" }}
					</button>
				</form>
			</div>
		</div>

		<!-- Tablet Content (after authentication) -->
		<div v-else class="flex-grow flex flex-col">
			<!-- Idle state - waiting for players -->
			<div v-if="players.length === 0" class="w-full flex-grow flex flex-col items-center justify-center p-4 text-center">
				<div class="text-6xl text-primary mb-6">
					<!-- Icon could go here -->
					<svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
					</svg>
				</div>
				<h2 class="text-2xl font-bold mb-2">Ready for Players</h2>
				<p class="text-gray-600 max-w-md">
					This tablet is registered as <strong>{{ tabletName }}</strong> and is waiting for players to be assigned from the admin panel.
				</p>
				<p v-if="!isConnected" class="text-red-500 mt-4">
					Currently offline. Please check your connection.
					<button @click="reconnect" class="underline ml-2">Reconnect</button>
				</p>
			</div>

			<!-- Welcome screen (after all players have signed) -->
			<div v-else-if="allSigned" class="w-full flex-grow flex flex-col items-center justify-center p-4 text-center bg-primary text-white">
				<div class="text-6xl mb-6">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
					</svg>
				</div>
				<h2 class="text-3xl font-bold mb-2">All Set!</h2>
				<p class="text-xl max-w-md">
					All waivers have been signed. Have a great time!
				</p>
			</div>

			<!-- Waiver signing interface with player list -->
			<div v-else class="w-full flex-grow flex flex-col">
				<header class="bg-primary text-white p-4">
					<div class="container mx-auto">
						<h1 class="text-xl font-bold">{{ activityTypeLabel }} Waivers</h1>
						<p>Players: {{ completedCount }}/{{ players.length }} signed</p>
					</div>
				</header>

				<div class="flex-grow flex">
					<!-- Player list sidebar -->
					<div class="w-1/3 bg-gray-50 border-r border-gray-200 overflow-y-auto">
						<div class="p-4">
							<h2 class="text-lg font-medium mb-4">Players</h2>

							<div class="space-y-2">
								<div
										v-for="(player, index) in players"
										:key="index"
										@click="selectPlayer(index)"
										class="p-3 rounded-lg cursor-pointer transition-colors duration-150 flex justify-between items-center"
										:class="{
                    'bg-primary/10 border-primary': selectedPlayerIndex === index,
                    'hover:bg-gray-200': selectedPlayerIndex !== index,
                    'border border-primary': selectedPlayerIndex === index,
                    'border border-transparent': selectedPlayerIndex !== index
                  }"
								>
									<span class="font-medium truncate">{{ player.name }}</span>
									<span
											class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
											:class="{
                      'bg-green-100 text-green-800': player.signed,
                      'bg-yellow-100 text-yellow-800': !player.signed
                    }"
									>
                    {{ player.signed ? "Signed" : "Pending" }}
                  </span>
								</div>
							</div>
						</div>
					</div>

					<!-- Waiver form -->
					<div class="w-2/3 overflow-y-auto p-4">
						<div v-if="selectedPlayer" class="space-y-4">
							<div class="card mb-4">
								<h2 class="text-xl font-semibold mb-2">Waiver Agreement for {{ selectedPlayer.name }}</h2>

								<div class="prose max-w-none mb-4">
									<p class="font-bold">Liability Waiver for {{ activityTypeLabel }}</p>

									<p>
										I, <strong>{{ selectedPlayer.name }}</strong>, understand that participation in {{ activityTypeLabel }}
										activities involves inherent risks of injury or damage to myself or others.
									</p>

									<p>
										By signing this waiver, I acknowledge these risks and agree to:
									</p>

									<ol>
										<li>Follow all safety instructions provided by staff</li>
										<li>Use all equipment properly and as directed</li>
										<li>Accept full responsibility for my actions during the activity</li>
										<li>Pay for any damages I cause to equipment or facilities</li>
									</ol>

									<p>
										I hereby release [Company Name], its employees, and representatives from any
										liability for injuries, damages, or losses that may occur during my participation.
									</p>
								</div>
							</div>

							<div class="card">
								<h3 class="text-lg font-medium mb-3">Signature</h3>
								<p class="text-sm text-gray-500 mb-4">Please sign below to indicate your agreement</p>

								<div class="border border-gray-300 bg-white rounded-lg mb-4">
									<SignatureCanvas ref="signaturePad"/>
								</div>

								<div class="flex space-x-3">
									<button @click="clearSignature" class="btn bg-gray-200 text-gray-700 hover:bg-gray-300">
										Clear
									</button>
									<button
											@click="submitSignature"
											class="btn-primary flex-grow"
											:disabled="!signatureIsValid || !isConnected || selectedPlayer.signed"
									>
										{{ selectedPlayer.signed ? "Already Signed" : "I Agree & Sign" }}
									</button>
									<button
											v-if="selectedPlayer.signed"
											@click="resetSignature"
											class="btn bg-red-100 text-red-700 hover:bg-red-200"
									>
										Reset
									</button>
								</div>

								<p v-if="!isConnected" class="text-red-500 text-center mt-2">
									Currently offline. Please reconnect before signing.
								</p>

								<div v-if="signatureSubmitted" class="mt-4 p-3 bg-green-50 text-green-700 rounded">
									Signature submitted successfully!
								</div>
							</div>
						</div>

						<div v-else class="flex items-center justify-center h-full text-gray-500">
							Please select a player from the list to sign their waiver.
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useTabletsStore } from "@/stores/tablets";
import { usePlayersStore } from "@/stores/players";
import SignatureCanvas from "../components/SignatureCanvas.vue";

const tabletsStore = useTabletsStore();
const playersStore = usePlayersStore();

// References
const signaturePad = ref(null);

// Debug toggle
const showDebug = ref(true);

// Tablet registration state
const tabletName = ref(tabletsStore.currentTabletName || "");
const tabletToken = ref("");
const registrationError = ref("");
const registrationInProgress = ref(false);
const isTabletAuthenticated = computed(() => tabletsStore.isTabletAuthenticated);
const isConnected = computed(() => tabletsStore.isConnected);

// UI feedback
const signatureSubmitted = ref(false);

// Connection status details
const connectionStatus = computed(() => {
	if (isConnected.value) return "Connected";
	if (!tabletsStore.isTabletAuthenticated) return "Not authenticated";
	return "Disconnected";
});

const connectionStatusDetails = ref("");

// Players state from updated store
const players = computed(() => playersStore.players);
const selectedPlayerIndex = computed(() => playersStore.selectedPlayerIndex);
const selectedPlayer = computed(() => playersStore.selectedPlayer);
const allSigned = computed(() => playersStore.allSigned);
const activityType = computed(() => playersStore.activityType);
const completedCount = computed(() => players.value.filter(p => p.signed).length);

// Computed properties
const signatureIsValid = computed(() => {
	return signaturePad.value && !signaturePad.value.isEmpty();
});

const activityTypeLabel = computed(() => {
	if (activityType.value === "laser-tag") return "Laser Tag";
	if (activityType.value === "escape-room") return "Escape Room";
	return "Activity";
});

// Handle players-assigned event
function handlePlayersAssigned(data) {
	console.log("Received players assignment:", data);
	if (data && data.players && Array.isArray(data.players)) {
		playersStore.setPlayers(data.players);

		if (data.activityType) {
			playersStore.setActivityType(data.activityType);
		}
	}
}

// Handle signature confirmation
function handleSignatureConfirmed(data) {
	console.log("Signature confirmation received:", data);
	if (data && data.success && data.playerName) {
		signatureSubmitted.value = true;

		// Hide the success message after 3 seconds
		setTimeout(() => {
			signatureSubmitted.value = false;
		}, 3000);
	}
}

// Force reconnection
function reconnect() {
	console.log("Manually reconnecting...");
	tabletsStore.initSocket();
	connectionStatusDetails.value = "Reconnecting...";

	// Clear status message after a delay
	setTimeout(() => {
		if (!isConnected.value) {
			connectionStatusDetails.value = "Failed to connect. Try again.";
		} else {
			connectionStatusDetails.value = "";
		}
	}, 5000);
}

// Methods
async function handleRegisterTablet() {
	console.log("Attempting to register tablet:", tabletName.value);
	registrationError.value = "";
	registrationInProgress.value = true;
	connectionStatusDetails.value = "Connecting...";

	try {
		await tabletsStore.registerTablet(tabletName.value, tabletToken.value);
		console.log("Registration successful");
		setupEventHandlers();
		registrationInProgress.value = false;
		connectionStatusDetails.value = "";
	} catch (error) {
		console.error("Registration failed:", error);
		registrationError.value = error.message || "Failed to register tablet";
		registrationInProgress.value = false;
		connectionStatusDetails.value = "Connection failed";
	}
}

// For testing without server
function useTestMode() {
	console.log("Using test mode");
	tabletsStore.manualAuthenticate(tabletName.value || "Test Tablet");
}

function resetTablet() {
	tabletsStore.disconnectTablet();
	playersStore.resetPlayers();
}

function selectPlayer(index) {
	playersStore.selectPlayer(index);

	// Clear signature pad if the selected player hasn't signed yet
	if (selectedPlayer.value && !selectedPlayer.value.signed && signaturePad.value) {
		signaturePad.value.clear();
	}
}

function clearSignature() {
	if (signaturePad.value) {
		signaturePad.value.clear();
	}
}

function resetSignature() {
	if (selectedPlayer.value) {
		playersStore.resetPlayerSignature(selectedPlayerIndex.value);
		if (signaturePad.value) {
			signaturePad.value.clear();
		}
	}
}

function submitSignature() {
	if (!signatureIsValid.value || !selectedPlayer.value || !isConnected.value || selectedPlayer.value.signed) {
		return;
	}

	try {
		const signatureData = signaturePad.value.getSignatureData();

		// Mark the current player as signed
		playersStore.markSelectedPlayerSigned(signatureData);

		// Reset success message state
		signatureSubmitted.value = false;

		// Send signature data to server if connected
		if (isConnected.value && tabletsStore.currentTabletId) {
			tabletsStore.sendMessage("player-signed", {
				tabletId: tabletsStore.currentTabletId,
				playerName: selectedPlayer.value.name,
				timestamp: new Date().toISOString(),
				activityType: activityType.value,
				signatureData,
			});

			console.log(`Signature for ${selectedPlayer.value.name} sent to server`);
		} else {
			console.warn("WebSocket not connected, signature saved locally only");
		}
	} catch (error) {
		console.error("Error submitting signature:", error);
	}
}

// Set up WebSocket event handlers
function setupEventHandlers() {
	console.log("Setting up WebSocket event handlers");

	// Remove any existing handlers to prevent duplicates
	tabletsStore.off("players-assigned");
	tabletsStore.off("signature-confirmed");

	// Set up new handlers
	tabletsStore.on("players-assigned", handlePlayersAssigned);
	tabletsStore.on("signature-confirmed", handleSignatureConfirmed);
}

// Connection management
function ensureConnection() {
	if (isTabletAuthenticated.value && !isConnected.value) {
		console.log("Not connected, attempting to connect...");
		tabletsStore.initSocket();
		connectionStatusDetails.value = "Reconnecting...";

		// Clear status message after a delay
		setTimeout(() => {
			if (!isConnected.value) {
				connectionStatusDetails.value = "Reconnection failed";
			} else {
				connectionStatusDetails.value = "";
			}
		}, 5000);
	}
}

// Lifecycle hooks
onMounted(() => {
	console.log("TabletView mounted, auth state:", isTabletAuthenticated.value);

	if (isTabletAuthenticated.value) {
		// Initialize WebSocket for authenticated tablets
		tabletsStore.initSocket();

		// Set up event handlers
		setupEventHandlers();

		// Set up periodic connection checker
		const connectionChecker = setInterval(() => {
			if (!isConnected.value) {
				connectionStatusDetails.value = "Connection lost, attempting to reconnect...";
				ensureConnection();
			} else {
				connectionStatusDetails.value = "";
			}
		}, 30000); // Check every 30 seconds

		// Clean up on unmount
		onUnmounted(() => {
			clearInterval(connectionChecker);
			tabletsStore.off("players-assigned", handlePlayersAssigned);
			tabletsStore.off("signature-confirmed", handleSignatureConfirmed);
		});
	}
});

// Watch for connection changes
watch(() => tabletsStore.isConnected, (newValue) => {
	console.log("Connection status changed:", newValue ? "connected" : "disconnected");

	if (newValue && isTabletAuthenticated.value) {
		setupEventHandlers();
		connectionStatusDetails.value = "";
	} else if (!newValue && isTabletAuthenticated.value) {
		connectionStatusDetails.value = "Connection lost";
	}
});

// Watch for authentication changes
watch(() => tabletsStore.isTabletAuthenticated, (newValue) => {
	console.log("Authentication state changed:", newValue);

	if (newValue) {
		ensureConnection();
		setupEventHandlers();
	}
});

// When selectedPlayer changes, ensure signature pad shows their signature or is cleared
watch(selectedPlayer, (newPlayer) => {
	if (newPlayer && signaturePad.value) {
		// Clear signature pad when switching to a new player
		signaturePad.value.clear();
		// Reset success message
		signatureSubmitted.value = false;
	}
});
</script>

<style scoped>
.prose ol {
	list-style-type: decimal;
	padding-left: 1.5rem;
	margin-top: 1rem;
	margin-bottom: 1rem;
}

.prose ol li {
	margin-bottom: 0.5rem;
}
</style>
