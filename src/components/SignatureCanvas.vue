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
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref(null)
const context = ref(null)
const isDrawing = ref(false)

// Expose methods to parent component
defineExpose({
	clear,
	isEmpty,
	getSignatureData
})

// Initialize canvas
onMounted(() => {
	const canvasEl = canvas.value
	context.value = canvasEl.getContext('2d')

	// Set canvas dimensions to match displayed size
	resizeCanvas()

	// Handle window resize
	window.addEventListener('resize', resizeCanvas)

	// Set up canvas styles
	const ctx = context.value
	ctx.lineWidth = 2
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'
	ctx.strokeStyle = '#000000'
})

onUnmounted(() => {
	window.removeEventListener('resize', resizeCanvas)
})

function resizeCanvas() {
	const canvasEl = canvas.value
	const rect = canvasEl.getBoundingClientRect()

	// Set canvas dimensions to actual displayed size
	canvasEl.width = rect.width
	canvasEl.height = rect.height

	// Reset styles after resize
	const ctx = context.value
	ctx.lineWidth = 2
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'
	ctx.strokeStyle = '#000000'
}

// Mouse events
function startDrawing(event) {
	isDrawing.value = true
	draw(event)
}

function draw(event) {
	if (!isDrawing.value) return

	const ctx = context.value
	const rect = canvas.value.getBoundingClientRect()

	ctx.beginPath()
	ctx.moveTo(lastX.value, lastY.value)
	ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top)
	ctx.stroke()

	lastX.value = event.clientX - rect.left
	lastY.value = event.clientY - rect.top
}

function stopDrawing() {
	isDrawing.value = false
}

// Touch events
function handleTouchStart(event) {
	event.preventDefault()

	if (event.touches.length > 0) {
		const touch = event.touches[0]
		const rect = canvas.value.getBoundingClientRect()

		lastX.value = touch.clientX - rect.left
		lastY.value = touch.clientY - rect.top

		isDrawing.value = true
	}
}

function handleTouchMove(event) {
	event.preventDefault()

	if (!isDrawing.value) return

	if (event.touches.length > 0) {
		const touch = event.touches[0]
		const rect = canvas.value.getBoundingClientRect()
		const x = touch.clientX - rect.left
		const y = touch.clientY - rect.top

		const ctx = context.value
		ctx.beginPath()
		ctx.moveTo(lastX.value, lastY.value)
		ctx.lineTo(x, y)
		ctx.stroke()

		lastX.value = x
		lastY.value = y
	}
}

// Track last position
const lastX = ref(0)
const lastY = ref(0)

// API methods
function clear() {
	const ctx = context.value
	ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
}

function isEmpty() {
	const ctx = context.value
	const pixelBuffer = new Uint32Array(
		ctx.getImageData(0, 0, canvas.value.width, canvas.value.height).data.buffer
	)
	return !pixelBuffer.some(color => color !== 0)
}

function getSignatureData() {
	return canvas.value.toDataURL('image/png')
}
</script>
