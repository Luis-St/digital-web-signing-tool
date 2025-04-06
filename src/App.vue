<template>
	<div class="min-h-full bg-slate-100">
		<!-- Debug info - remove in production -->
		<div v-if="showDebug" class="bg-yellow-100 p-2 text-xs">
			<p>Current route: {{ $route.path }}</p>
			<p>Auth state: {{ isAuthenticated ? "Logged in" : "Not logged in" }}</p>
			<button @click="showDebug = false" class="text-blue-500 underline">Hide</button>
		</div>

		<!-- Router view where components will be rendered -->
		<router-view v-slot="{ Component }">
			<transition name="fade" mode="out-in">
				<component :is="Component"/>
			</transition>
		</router-view>
	</div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useAdminStore } from "./stores/admin";

// For debugging - display current auth state
const showDebug = ref(true);
const adminStore = useAdminStore();
const isAuthenticated = computed(() => adminStore.isAuthenticated);
</script>

<style>
/* Transition effects for page changes */
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
