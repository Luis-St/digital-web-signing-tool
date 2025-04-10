<template>
	<div class="signature-canvas">
		<canvas
				ref="canvas"
				class="w-full touch-none"
				style="height: 200px"
				@mousedown="startDrawing"
				@mousemove="draw"
				@mouseup="stopDrawing"
				@mouseout="stopDrawing"
				@touchstart="handleTouchStart"
				@touchmove="handleTouchMove"
				@touchend="stopDrawing"
		></canvas>
	</div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";

const canvas = ref(null);
const context = ref(null);
const isDrawing = ref(false);

// Track last position
const lastX = ref(0);
const lastY = ref(0);

// Define emits
const emit = defineEmits(["signature-change"]);

// Expose methods to parent component
defineExpose({
	clear,
	isEmpty,
	getSignatureData,
});

// Initialize canvas
onMounted(() => {
	const canvasEl = canvas.value;
	context.value = canvasEl.getContext("2d");

	// Set canvas dimensions to match displayed size
	resizeCanvas();

	// Handle window resize
	window.addEventListener("resize", resizeCanvas);

	// Set up canvas styles
	const ctx = context.value;
	ctx.lineWidth = 2.5;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeStyle = "#000000";
});

onUnmounted(() => {
	window.removeEventListener("resize", resizeCanvas);
});

function resizeCanvas() {
	const canvasEl = canvas.value;
	const rect = canvasEl.getBoundingClientRect();

	// Set canvas dimensions to actual displayed size
	canvasEl.width = rect.width;
	canvasEl.height = rect.height;

	// Reset styles after resize
	const ctx = context.value;
	ctx.lineWidth = 2.5;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.strokeStyle = "#000000";
}

// Mouse events
function startDrawing(event) {
	const rect = canvas.value.getBoundingClientRect();
	lastX.value = event.clientX - rect.left;
	lastY.value = event.clientY - rect.top;

	isDrawing.value = true;
}

function draw(event) {
	if (!isDrawing.value) return;

	const ctx = context.value;
	const rect = canvas.value.getBoundingClientRect();
	const currentX = event.clientX - rect.left;
	const currentY = event.clientY - rect.top;

	ctx.beginPath();
	ctx.moveTo(lastX.value, lastY.value);
	ctx.lineTo(currentX, currentY);
	ctx.stroke();

	lastX.value = currentX;
	lastY.value = currentY;

	// Emit change event after drawing
	emit("signature-change", isEmpty());
}

function stopDrawing() {
	if (isDrawing.value) {
		isDrawing.value = false;
		// Emit change event when stopping drawing
		emit("signature-change", isEmpty());
	}
}

// Touch events
function handleTouchStart(event) {
	event.preventDefault();

	if (event.touches.length > 0) {
		const touch = event.touches[0];
		const rect = canvas.value.getBoundingClientRect();

		lastX.value = touch.clientX - rect.left;
		lastY.value = touch.clientY - rect.top;

		isDrawing.value = true;
	}
}

function handleTouchMove(event) {
	event.preventDefault();

	if (!isDrawing.value) return;

	if (event.touches.length > 0) {
		const touch = event.touches[0];
		const rect = canvas.value.getBoundingClientRect();
		const currentX = touch.clientX - rect.left;
		const currentY = touch.clientY - rect.top;

		const ctx = context.value;
		ctx.beginPath();
		ctx.moveTo(lastX.value, lastY.value);
		ctx.lineTo(currentX, currentY);
		ctx.stroke();

		lastX.value = currentX;
		lastY.value = currentY;

		// Emit change event after drawing
		emit("signature-change", isEmpty());
	}
}

// API methods
function clear() {
	const ctx = context.value;
	ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
	// Emit change event after clearing
	emit("signature-change", true);
}

function isEmpty() {
	const ctx = context.value;
	const pixelBuffer = new Uint32Array(
		ctx.getImageData(0, 0, canvas.value.width, canvas.value.height).data.buffer,
	);
	return !pixelBuffer.some(color => color !== 0);
}

function getSignatureData() {
	return canvas.value.toDataURL("image/png");
}
</script>

<style scoped>
.signature-canvas {
	touch-action: none; /* Prevents browser handling of touch events */
}
</style>
