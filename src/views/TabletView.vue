<template>
	<div class="min-h-screen flex flex-col">
		<!-- Debug info - remove in production -->
		<div v-if="showDebug" class="bg-yellow-100 p-2 text-xs border-b">
			<p>Tablet state: {{ isTabletAuthenticated ? "Authenticated" : "Not authenticated" }}</p>
			<p>Tablet name: {{ tabletName }}</p>
			<p>Socket connected: {{ socketConnected ? "Yes" : "No" }}</p>
			<div class="flex space-x-2 mt-1">
				<button @click="showDebug = false" class="text-blue-500 underline">Hide</button>
				<button v-if="!isTabletAuthenticated" @click="useTestMode" class="text-green-500 underline">Test Mode</button>
				<button v-if="isTabletAuthenticated" @click="resetTablet" class="text-red-500 underline">Reset</button>
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

					<button type="submit" class="btn-primary w-full">
						Register Tablet
					</button>
				</form>
			</div>
		</div>

		<!-- Tablet Content (after authentication) -->
		<div v-else class="flex-grow flex">
			<!-- Idle state - waiting for players -->
			<div v-if="!currentPlayer" class="w-full flex-grow flex flex-col items-center justify-center p-4 text-center">
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

			<!-- Waiver signing interface -->
			<div v-else class="w-full flex-grow flex flex-col">
				<header class="bg-primary text-white p-4">
					<div class="container mx-auto">
						<h1 class="text-xl font-bold">Sign Waiver</h1>
						<p>{{ currentPlayer.name }}</p>
					</div>
				</header>

				<div class="flex-grow overflow-y-auto p-4">
					<div class="card mb-4">
						<h2 class="text-xl font-semibold mb-4">Waiver Agreement</h2>

						<div class="prose max-w-none mb-4">
							<p class="font-bold">Liability Waiver for {{ activityTypeLabel }}</p>

							<p>
								I, {{ currentPlayer.name }}, understand that participation in {{ activityTypeLabel }}
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

						<div class="flex space-x-4">
							<button @click="clearSignature" class="btn bg-gray-200 text-gray-700 hover:bg-gray-300">
								Clear
							</button>
							<button @click="submitSignature" class="btn-primary flex-grow" :disabled="!signatureIsValid">
								I Agree & Sign
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
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
const isTabletAuthenticated = computed(() => tabletsStore.isTabletAuthenticated);
const socketConnected = ref(false);

// Players state
const currentPlayer = computed(() => playersStore.currentPlayer);
const allSigned = computed(() => playersStore.allSigned);
const activityType = computed(() => playersStore.activityType);

// Computed properties
const signatureIsValid = computed(() => {
	return signaturePad.value && !signaturePad.value.isEmpty();
});

const activityTypeLabel = computed(() => {
	if (activityType.value === "laser-tag") return "Laser Tag";
	if (activityType.value === "escape-room") return "Escape Room";
	return "Activity";
});

// Methods
function handleRegisterTablet() {
	console.log("Attempting to register tablet:", tabletName.value);
	registrationError.value = "";

	tabletsStore.registerTablet(tabletName.value, tabletToken.value)
		.then(response => {
			console.log("Registration successful:", response);
		})
		.catch(error => {
			console.error("Registration failed:", error);
			registrationError.value = error.message || "Failed to register tablet";
		});
}

// For testing without server
function useTestMode() {
	console.log("Using test mode");
	tabletsStore.manualAuthenticate(tabletName.value || "Test Tablet");
}

function resetTablet() {
	tabletsStore.disconnectTablet();
}

function clearSignature() {
	if (signaturePad.value) {
		signaturePad.value.clear();
	}
}

function submitSignature() {
	if (!signatureIsValid.value || !currentPlayer.value) return;

	try {
		const signatureData = signaturePad.value.getSignatureData();
		playersStore.markCurrentPlayerSigned(signatureData);

		// Send signature data to server if connected
		const socket = tabletsStore.socket;
		if (socket && socket.value && socket.value.connected && tabletsStore.currentTabletId) {
			socket.value.emit("player-signed", {
				tabletId: tabletsStore.currentTabletId,
				playerName: currentPlayer.value.name,
				timestamp: new Date().toISOString(),
				activityType: activityType.value,
				signatureData,
			});
		} else {
			console.warn("Socket not connected, signature saved locally only");
		}
	} catch (error) {
		console.error("Error submitting signature:", error);
	}
}

// Lifecycle hooks
onMounted(() => {
	console.log("TabletView mounted, auth state:", isTabletAuthenticated.value);

	if (!isTabletAuthenticated.value) {
		// Not authenticated, no further actions needed
		return;
	}

	// Initialize socket for authenticated tablets
	if (!tabletsStore.socket || !tabletsStore.socket.value) {
		tabletsStore.initSocket();
	}

	// Monitor socket connection
	const checkSocketConnection = setInterval(() => {
		const socket = tabletsStore.socket;
		socketConnected.value = socket && socket.value && socket.value.connected;
	}, 2000);

	// Clean up interval on unmount
	onUnmounted(() => {
		clearInterval(checkSocketConnection);
	});
});
</script>
