<template>
  <div class="game-canvas-container">
    <canvas
      ref="canvas"
      :width="canvasWidth"
      :height="canvasHeight"
      @mousedown="startDrag"
      @mousemove="updateDrag"
      @mouseup="endDrag"
      @touchstart.prevent="startDragTouch"
      @touchmove.prevent="updateDragTouch"
      @touchend.prevent="endDragTouch"
      class="game-canvas"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useGamePhysics } from '../composables/useGamePhysics'

const props = defineProps({
  level: {
    type: Object,
    required: true
  },
  settings: {
    type: Object,
    required: true
  },
  isPaused: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['goal-reached', 'player-fell', 'jump'])

const canvas = ref(null)
const ctx = ref(null)
const animationFrame = ref(null)

const canvasWidth = computed(() => props.settings.canvasWidth)
const canvasHeight = computed(() => props.settings.canvasHeight)

// Drag and drop state
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const dragCurrent = ref({ x: 0, y: 0 })

// Physics
const physics = useGamePhysics(props.settings)

// Particle system for background
const particles = ref([])

function initParticles() {
  // Check if canvas dimensions are available
  if (!canvasWidth.value || !canvasHeight.value) {
    return
  }

  particles.value = []
  const numParticles = 40
  for (let i = 0; i < numParticles; i++) {
    particles.value.push({
      x: Math.random() * canvasWidth.value,
      y: Math.random() * canvasHeight.value,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.1
    })
  }
}

// Initialize player position
watch(() => props.level, (newLevel) => {
  if (newLevel) {
    physics.setPosition(newLevel.startPosition.x, newLevel.startPosition.y)
    physics.startFalling()
    initParticles()
  }
}, { immediate: true })

function updateParticles() {
  particles.value.forEach(particle => {
    particle.x += particle.vx
    particle.y += particle.vy

    // Wrap around screen
    if (particle.x < 0) particle.x = canvasWidth.value
    if (particle.x > canvasWidth.value) particle.x = 0
    if (particle.y < 0) particle.y = canvasHeight.value
    if (particle.y > canvasHeight.value) particle.y = 0
  })
}

function drawParticles() {
  if (!particles.value || particles.value.length === 0) return

  particles.value.forEach(particle => {
    ctx.value.fillStyle = `rgba(232, 232, 232, ${particle.opacity})`
    ctx.value.beginPath()
    ctx.value.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ctx.value.fill()
  })
}

function drawStartFlag() {
  if (!props.level || !props.level.startPosition || !props.level.platforms) return

  // Find the platform directly below the start position
  const startX = props.level.startPosition.x + props.settings.playerWidth / 2
  const startY = props.level.startPosition.y + props.settings.playerHeight

  let landingPlatform = null
  let closestDistance = Infinity

  // Find the closest platform below the start position
  for (const platform of props.level.platforms) {
    const platformLeft = platform.x
    const platformRight = platform.x + platform.width
    const platformTop = platform.y

    // Check if start position is horizontally aligned with this platform
    if (startX >= platformLeft && startX <= platformRight && platformTop > startY) {
      const distance = platformTop - startY
      if (distance < closestDistance) {
        closestDistance = distance
        landingPlatform = platform
      }
    }
  }

  if (!landingPlatform) return

  // Position flag on the landing platform
  const flagX = props.level.startPosition.x + props.settings.playerWidth / 2
  const flagY = landingPlatform.y - 30
  const poleHeight = 25
  const flagWidth = 15
  const flagHeight = 10

  // Flag pole
  ctx.value.strokeStyle = '#8b7355'
  ctx.value.lineWidth = 2
  ctx.value.beginPath()
  ctx.value.moveTo(flagX, flagY)
  ctx.value.lineTo(flagX, flagY + poleHeight)
  ctx.value.stroke()

  // Flag
  ctx.value.fillStyle = '#4ade80'
  ctx.value.beginPath()
  ctx.value.moveTo(flagX, flagY)
  ctx.value.lineTo(flagX + flagWidth, flagY + flagHeight / 2)
  ctx.value.lineTo(flagX, flagY + flagHeight)
  ctx.value.closePath()
  ctx.value.fill()

  ctx.value.strokeStyle = '#22c55e'
  ctx.value.lineWidth = 1
  ctx.value.stroke()
}
function getCanvasCoordinates(clientX, clientY) {
  const rect = canvas.value.getBoundingClientRect()
  const scaleX = canvas.value.width / rect.width
  const scaleY = canvas.value.height / rect.height

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  }
}

function isClickOnPlayer(x, y) {
  const playerX = physics.playerPosition.value.x
  const playerY = physics.playerPosition.value.y

  return (
    x >= playerX &&
    x <= playerX + props.settings.playerWidth &&
    y >= playerY &&
    y <= playerY + props.settings.playerHeight
  )
}

function startDrag(event) {
  // Don't allow dragging when paused
  if (props.isPaused) return

  const coords = getCanvasCoordinates(event.clientX, event.clientY)

  if (isClickOnPlayer(coords.x, coords.y) && !physics.isJumping.value) {
    isDragging.value = true
    dragStart.value = coords
    dragCurrent.value = coords
  }
}

function updateDrag(event) {
  if (isDragging.value) {
    dragCurrent.value = getCanvasCoordinates(event.clientX, event.clientY)
  }
}

function endDrag(event) {
  if (isDragging.value) {
    const dx = dragStart.value.x - dragCurrent.value.x
    const dy = dragStart.value.y - dragCurrent.value.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    if (distance > 5) {
      physics.jump(distance, angle)
      emit('jump')
    }

    isDragging.value = false
  }
}

function startDragTouch(event) {
  // Don't allow dragging when paused
  if (props.isPaused) return

  const touch = event.touches[0]
  const coords = getCanvasCoordinates(touch.clientX, touch.clientY)

  if (isClickOnPlayer(coords.x, coords.y) && !physics.isJumping.value) {
    isDragging.value = true
    dragStart.value = coords
    dragCurrent.value = coords
  }
}

function updateDragTouch(event) {
  if (isDragging.value && event.touches.length > 0) {
    const touch = event.touches[0]
    dragCurrent.value = getCanvasCoordinates(touch.clientX, touch.clientY)
  }
}

function endDragTouch(event) {
  if (isDragging.value) {
    const dx = dragStart.value.x - dragCurrent.value.x
    const dy = dragStart.value.y - dragCurrent.value.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    if (distance > 5) {
      physics.jump(distance, angle)
      emit('jump')
    }

    isDragging.value = false
  }
}

function drawPlatform(platform, color = '#3a3a4e') {
  // Platform base
  ctx.value.fillStyle = color
  ctx.value.fillRect(platform.x, platform.y, platform.width, platform.height)

  // Top highlight
  ctx.value.fillStyle = '#4a4a5e'
  ctx.value.fillRect(platform.x, platform.y, platform.width, 3)

  // Border
  ctx.value.strokeStyle = '#2a2a3e'
  ctx.value.lineWidth = 2
  ctx.value.strokeRect(platform.x, platform.y, platform.width, platform.height)
}

function drawPlayer() {
  const x = physics.playerPosition.value.x

  // Calculate scale factors (base size is 16x32)
  // Use square root for less aggressive scaling (player won't be huge on large screens)
  const baseScaleX = props.settings.playerWidth / 16
  const baseScaleY = props.settings.playerHeight / 32
  const scaleX = Math.sqrt(baseScaleX)
  const scaleY = Math.sqrt(baseScaleY)

  // Use average scale for uniform appearance
  const scale = (scaleX + scaleY) / 2

  // Visual height based on the scale we're actually using for drawing
  const visualHeight = 32 * scale
  // Offset to align visual feet with collision box bottom
  const yOffset = props.settings.playerHeight - visualHeight
  const y = physics.playerPosition.value.y + yOffset

  const centerX = x + props.settings.playerWidth / 2
  const centerY = physics.playerPosition.value.y + props.settings.playerHeight / 2

  // Calculate rotation based on velocity
  let rotation = 0
  if (physics.isJumping.value) {
    const vx = physics.velocity.value.x
    const vy = physics.velocity.value.y
    const speed = Math.sqrt(vx * vx + vy * vy)

    // More visible rotation based on direction and speed
    if (speed > 0.5) {
      rotation = Math.atan2(vy, Math.abs(vx)) * 0.5

      // Flip rotation for left movement
      if (vx < 0) {
        rotation = -rotation
      }
    }
  }

  ctx.value.save()
  ctx.value.translate(centerX, centerY)
  ctx.value.rotate(rotation)
  ctx.value.translate(-centerX, -centerY)

  // Head
  ctx.value.fillStyle = '#f5deb3' // Skin tone
  ctx.value.beginPath()
  ctx.value.arc(centerX, y + 6 * scale, 6 * scale, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.strokeStyle = '#8b7355'
  ctx.value.lineWidth = 1 * scale
  ctx.value.stroke()

  // Body
  ctx.value.fillStyle = '#2a2a3e' // Dark clothing
  ctx.value.fillRect(centerX - 5 * scale, y + 12 * scale, 10 * scale, 12 * scale)
  ctx.value.strokeStyle = '#1a1a2e'
  ctx.value.lineWidth = 1 * scale
  ctx.value.strokeRect(centerX - 5 * scale, y + 12 * scale, 10 * scale, 12 * scale)

  // Arms
  ctx.value.strokeStyle = '#f5deb3'
  ctx.value.lineWidth = 2 * scale
  ctx.value.lineCap = 'round'

  // Left arm
  ctx.value.beginPath()
  ctx.value.moveTo(centerX - 5 * scale, y + 14 * scale)
  ctx.value.lineTo(centerX - 9 * scale, y + 20 * scale)
  ctx.value.stroke()

  // Right arm
  ctx.value.beginPath()
  ctx.value.moveTo(centerX + 5 * scale, y + 14 * scale)
  ctx.value.lineTo(centerX + 9 * scale, y + 20 * scale)
  ctx.value.stroke()

  // Legs
  ctx.value.strokeStyle = '#2a2a3e'
  ctx.value.lineWidth = 3 * scale

  // Left leg
  ctx.value.beginPath()
  ctx.value.moveTo(centerX - 2 * scale, y + 24 * scale)
  ctx.value.lineTo(centerX - 6 * scale, y + 32 * scale)
  ctx.value.stroke()

  // Right leg
  ctx.value.beginPath()
  ctx.value.moveTo(centerX + 2 * scale, y + 24 * scale)
  ctx.value.lineTo(centerX + 6 * scale, y + 32 * scale)
  ctx.value.stroke()

  // Eyes
  ctx.value.fillStyle = '#000000'
  ctx.value.fillRect(centerX - 3 * scale, y + 5 * scale, 2 * scale, 2 * scale)
  ctx.value.fillRect(centerX + 1 * scale, y + 5 * scale, 2 * scale, 2 * scale)

  ctx.value.restore()
}

function drawGoal(goal) {
  // Calculate scale factor based on goal width (base width is 130)
  // Use square root for less aggressive scaling
  const baseScale = goal.width / 130
  const scale = Math.sqrt(baseScale)

  // Glowing goal area
  ctx.value.shadowBlur = 20 * scale
  ctx.value.shadowColor = '#4ade80'
  ctx.value.fillStyle = '#22c55e'
  ctx.value.fillRect(goal.x, goal.y, goal.width, goal.height)
  ctx.value.shadowBlur = 0

  // Goal border
  ctx.value.strokeStyle = '#16a34a'
  ctx.value.lineWidth = 3 * scale
  ctx.value.strokeRect(goal.x, goal.y, goal.width, goal.height)

  // Animated particles effect (simple dots)
  ctx.value.fillStyle = '#4ade80'
  for (let i = 0; i < 3; i++) {
    const dotX = goal.x + Math.random() * goal.width
    const dotY = goal.y + Math.random() * goal.height
    ctx.value.beginPath()
    ctx.value.arc(dotX, dotY, 2 * scale, 0, Math.PI * 2)
    ctx.value.fill()
  }
}

function drawDragIndicator() {
  if (isDragging.value) {
    const dx = dragCurrent.value.x - dragStart.value.x
    const dy = dragCurrent.value.y - dragStart.value.y
    const distance = Math.min(
      Math.sqrt(dx * dx + dy * dy),
      props.settings.maxDragDistance
    )
    const angle = Math.atan2(dy, dx)

    const endX = dragStart.value.x + Math.cos(angle) * distance
    const endY = dragStart.value.y + Math.sin(angle) * distance

    // Draw clean arrow line (no shadow)
    ctx.value.strokeStyle = '#ef4444'
    ctx.value.lineWidth = 3
    ctx.value.lineCap = 'round'
    ctx.value.beginPath()
    ctx.value.moveTo(dragStart.value.x, dragStart.value.y)
    ctx.value.lineTo(endX, endY)
    ctx.value.stroke()

    // Draw arrow head
    const arrowSize = 10
    ctx.value.fillStyle = '#ef4444'
    ctx.value.beginPath()
    ctx.value.moveTo(endX, endY)
    ctx.value.lineTo(
      endX - arrowSize * Math.cos(angle - Math.PI / 6),
      endY - arrowSize * Math.sin(angle - Math.PI / 6)
    )
    ctx.value.lineTo(
      endX - arrowSize * Math.cos(angle + Math.PI / 6),
      endY - arrowSize * Math.sin(angle + Math.PI / 6)
    )
    ctx.value.closePath()
    ctx.value.fill()

    // Draw power indicator based on drag distance (0-100%)
    const powerPercent = (distance / props.settings.maxDragDistance) * 100

    ctx.value.fillStyle = '#e8e8e8'
    ctx.value.font = 'bold 16px Arial'
    ctx.value.strokeStyle = '#1a1a2e'
    ctx.value.lineWidth = 3
    ctx.value.strokeText(
      `Sila: ${Math.round(powerPercent)}%`,
      dragStart.value.x + 10,
      dragStart.value.y - 10
    )
    ctx.value.fillText(
      `Sila: ${Math.round(powerPercent)}%`,
      dragStart.value.x + 10,
      dragStart.value.y - 10
    )
  }
}

function draw() {
  // Clear canvas
  ctx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Dark Background
  const gradient = ctx.value.createLinearGradient(0, 0, 0, canvasHeight.value)
  gradient.addColorStop(0, '#0f1626')
  gradient.addColorStop(0.5, '#16213e')
  gradient.addColorStop(1, '#1a1a2e')
  ctx.value.fillStyle = gradient
  ctx.value.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Draw particles
  drawParticles()

  // Draw start flag
  drawStartFlag()

  // Draw platforms
  props.level.platforms.forEach(platform => drawPlatform(platform, '#3a3a4e'))

  // Draw goal
  drawGoal(props.level.goal)

  // Draw player
  drawPlayer()

  // Draw drag indicator
  drawDragIndicator()
}

function gameLoop() {
  // Only update game state when not paused
  if (!props.isPaused) {
    // Update particles
    updateParticles()

    // Update physics
    const status = physics.updatePhysics(props.level.platforms, canvasHeight.value)

    if (status === 'fell') {
      emit('player-fell')
      // Reset player to start position
      physics.setPosition(props.level.startPosition.x, props.level.startPosition.y)
      physics.startFalling()
    }

    // Check goal collision
    if (physics.checkGoalCollision(props.level.goal)) {
      emit('goal-reached')
      cancelAnimationFrame(animationFrame.value)
      return
    }
  }

  // Always draw (even when paused)
  draw()

  // Continue loop
  animationFrame.value = requestAnimationFrame(gameLoop)
}

function resetPlayer() {
  physics.setPosition(props.level.startPosition.x, props.level.startPosition.y)
  physics.startFalling()
  draw()
}

onMounted(() => {
  ctx.value = canvas.value.getContext('2d')
  physics.setPosition(props.level.startPosition.x, props.level.startPosition.y)
  physics.startFalling()
  initParticles()
  gameLoop()
})

onUnmounted(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
  }
})

defineExpose({
  resetPlayer
})
</script>

<style src="../css/game-canvas.css"></style>
