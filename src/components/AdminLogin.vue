<template>
	<div class="min-h-screen flex items-center justify-center bg-gray-100">
		<div class="card w-full max-w-md">
			<div class="mb-6 text-center">
				<h1 class="text-2xl font-bold text-primary">Waiver System</h1>
				<p class="text-gray-600">Admin Login</p>
			</div>

			<form @submit.prevent="handleLogin" class="space-y-4">
				<div>
					<label for="username" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
					<input
							id="username"
							v-model="username"
							type="text"
							class="input w-full"
							required
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
					<input
							id="password"
							v-model="password"
							type="password"
							class="input w-full"
							required
					/>
				</div>

				<div v-if="errorMessage" class="text-red-500 text-sm">
					{{ errorMessage }}
				</div>

				<button type="submit" class="btn-primary w-full">Login</button>
			</form>
		</div>
	</div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAdminStore } from "@/stores/admin";

const router = useRouter();
const adminStore = useAdminStore();

const username = ref("");
const password = ref("");
const errorMessage = ref("");

// If already authenticated, redirect to admin
onMounted(() => {
	console.log("Login component mounted. Authentication state:", adminStore.isAuthenticated);
	if (adminStore.isAuthenticated) {
		console.log("Already authenticated, redirecting to admin");
		router.push("/admin");
	}
});

function handleLogin() {
	errorMessage.value = ""; // Clear previous error

	// Add some debugging
	console.log("Login attempt with username:", username.value);
	console.log("Environment variable exists:", !!import.meta.env.VITE_ADMIN_USERNAME);

	if (adminStore.login(username.value, password.value)) {
		console.log("Login successful, redirecting to admin");
		router.push("/admin");
	} else {
		console.log("Login failed");
		errorMessage.value = "Invalid username or password";
	}
}
</script>