<template>
	<div class="min-h-screen flex flex-col">
		<!-- Tablet Authentication -->
		<div v-if="!isTabletAuthenticated" class="flex-grow flex items-center justify-center p-4">
			<div class="card w-full max-w-md">
				<h1 class="text-2xl font-bold text-center text-primary mb-6">Tablet Registration</h1>

				<form @submit.prevent="registerTablet" class="space-y-4">
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
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
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
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
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
							<SignatureCanvas ref="signaturePad" />
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
import { ref, computed, watch, onMounted, onUnmounted } from "vue"
import { useTabletsStore } from "@/stores/tablets"
import { usePlayersStore } from "@/stores/players"
import SignatureCanvas from "@/components/SignatureCanvas.vue"
import { io } from "socket.io-client"

const tabletsStore = useTabletsStore()
const playersStore = usePlayersStore()

// References
const signaturePad = ref(null)

// Tablet registration state
const tabletName = ref("")
const tabletToken = ref("")
const registrationError = ref("")
const { isTabletAuthenticated, registerTablet: register, currentTabletId, socket } = tabletsStore

// Players state
const { currentPlayer, allSigned, markCurrentPlayerSigned, activityType } = playersStore

// Computed properties
const signatureIsValid = computed(() => {
	return signaturePad.value && !signaturePad.value.isEmpty()
})

const activityTypeLabel = computed(() => {
	if (activityType.value === "laser-tag") return "Laser Tag"
	if (activityType.value === "escape-room") return "Escape Room"
	return "Activity"
})

// Methods
function registerTablet() {
	registrationError.value = ""

	register(tabletName.value, tabletToken.value)
		.catch(error => {
			registrationError.value = error.message
		})
}

function clearSignature() {
	if (signaturePad.value) {
		signaturePad.value.clear()
	}
}

function submitSignature() {
	if (!signatureIsValid.value) return

	const signatureData = signaturePad.value.getSignatureData()
	markCurrentPlayerSigned(signatureData)

	// Send signature data to server
	socket.value.emit("player-signed", {
		tabletId: currentTabletId.value,
		playerName: currentPlayer.value.name,
		timestamp: new Date().toISOString(),
		activityType: activityType.value,
		signatureData
	})
}

// Connect tablet to server and set up socket events
onMounted(() => {
	if (!socket.value) {
		socket.value = io(import.meta.env.VITE_SOCKET_URL)

		socket.value.on("connect", () => {
			console.log("Connected to server")
		})

		socket.value.on("players-assigned", ({ players, activityType: activity }) => {
			playersStore.setPlayers(players)
			playersStore.setActivityType(activity)
		})
	}
})

onUnmounted(() => {
	if (socket.value) {
		socket.value.disconnect()
	}
})
</script>
