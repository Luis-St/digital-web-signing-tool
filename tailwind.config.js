/** @type {import("tailwindcss").Config} */
module.exports = {
	content: [
		"./index.html",
		"./src/**/*.{vue,js,ts,jsx,tsx}",
		"./src/**/**/*.{vue,js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				"primary": "#1e40af", // deep blue
				"secondary": "#6b21a8", // purple
				"accent": "#f59e0b", // amber
			},
		},
	},
	plugins: [],
};