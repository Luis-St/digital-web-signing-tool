import { createRouter, createWebHistory } from "vue-router";
import AdminView from "../views/AdminView.vue";
import TabletView from "../views/TabletView.vue";
import AdminLogin from "../components/AdminLogin.vue";

// Store imports should use a function to prevent circular dependencies
const getAdminStore = () => {
	return import("../stores/admin").then(module => module.useAdminStore());
};

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: "/",
			redirect: "/admin/login",
		},
		{
			path: "/admin",
			name: "admin",
			component: AdminView,
			meta: { requiresAuth: true },
		},
		{
			path: "/admin/login",
			name: "adminLogin",
			component: AdminLogin,
		},
		{
			path: "/tablet",
			name: "tablet",
			component: TabletView,
		},
	],
});

// Navigation guard for admin routes
router.beforeEach(async (to, from, next) => {
	if (to.meta.requiresAuth) {
		const adminStore = await getAdminStore();
		
		if (!adminStore.isAuthenticated) {
			console.log("Not authenticated, redirecting to login");
			next({ name: "adminLogin" });
		} else {
			console.log("Authenticated, proceeding to admin");
			next();
		}
	} else {
		next();
	}
});

export default router;
