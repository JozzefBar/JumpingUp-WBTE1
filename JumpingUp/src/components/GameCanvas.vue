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

// Obstacles system
const obstacles = ref([])

// Barriers system (static stone walls)
const barriers = ref([])

// Collectibles system (keys, etc.)
const collectibles = ref([])

// Doors system (locked/unlocked gates)
const doors = ref([])

// Trajectory vision system
const hasTrajectoryVision = ref(false)

function initParticles() {
  // Check if canvas dimensions are available
  if (!canvasWidth.value || !canvasHeight.value) {
    return
  }

  particles.value = []
  const numParticles = 50 // More particles for sakura petals
  for (let i = 0; i < numParticles; i++) {
    particles.value.push({
      x: Math.random() * canvasWidth.value,
      y: Math.random() * canvasHeight.value,
      vx: (Math.random() - 0.7) * 0.5, // Slight drift to the left
      vy: Math.random() * 0.3 + 0.1, // Falling down
      size: Math.random() * 3 + 2,
      opacity: Math.random() * 0.5 + 0.3,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05
    })
  }
}

function initObstacles() {
  if (!props.level || !props.level.obstacles) {
    obstacles.value = []
    return
  }

  // Deep copy obstacles from level data
  obstacles.value = props.level.obstacles.map(obs => ({
    x: obs.x,
    y: obs.y,
    width: obs.width,
    height: obs.height,
    velocityX: obs.velocityX,
    velocityY: obs.velocityY,
    minX: obs.minX,
    maxX: obs.maxX,
    minY: obs.minY,
    maxY: obs.maxY
  }))
}

function initBarriers() {
  if (!props.level || !props.level.barriers) {
    barriers.value = []
    return
  }

  barriers.value = props.level.barriers.map(barrier => ({
    x: barrier.xPercent !== undefined ? barrier.xPercent * canvasWidth.value : barrier.x,
    y: barrier.yPercent !== undefined ? barrier.yPercent * canvasHeight.value : barrier.y,
    width: barrier.widthPercent !== undefined ? barrier.widthPercent * canvasWidth.value : barrier.width,
    height: barrier.heightPercent !== undefined ? barrier.heightPercent * canvasHeight.value : barrier.height
  }))
}

function initCollectibles() {
  if (!props.level || !props.level.collectibles) {
    collectibles.value = []
    return
  }

  collectibles.value = props.level.collectibles.map(item => ({
    type: item.type,
    x: item.xPercent !== undefined ? item.xPercent * canvasWidth.value : item.x,
    y: item.yPercent !== undefined ? item.yPercent * canvasHeight.value : item.y,
    width: item.widthPercent !== undefined ? item.widthPercent * canvasWidth.value : item.width,
    height: item.heightPercent !== undefined ? item.heightPercent * canvasHeight.value : item.height,
    collected: item.collected || false
  }))
}

function initDoors() {
  if (!props.level || !props.level.doors) {
    doors.value = []
    return
  }

  doors.value = props.level.doors.map(door => ({
    x: door.xPercent !== undefined ? door.xPercent * canvasWidth.value : door.x,
    y: door.yPercent !== undefined ? door.yPercent * canvasHeight.value : door.y,
    width: door.widthPercent !== undefined ? door.widthPercent * canvasWidth.value : door.width,
    height: door.heightPercent !== undefined ? door.heightPercent * canvasHeight.value : door.height,
    requiresKey: door.requiresKey,
    isOpen: door.isOpen || false
  }))
}

// Initialize player position
watch(() => props.level, (newLevel) => {
  if (newLevel) {
    physics.setPosition(newLevel.startPosition.x, newLevel.startPosition.y)
    physics.startFalling()
    initParticles()
    initObstacles()
    initBarriers()
    initCollectibles()
    initDoors()
    hasTrajectoryVision.value = false // Reset trajectory vision on level change
  }
}, { immediate: true })

// Re-initialize responsive elements when canvas size changes
watch([canvasWidth, canvasHeight], () => {
  if (props.level) {
    initBarriers()
    initCollectibles()
    initDoors()
  }
})

function updateParticles() {
  particles.value.forEach(particle => {
    particle.x += particle.vx
    particle.y += particle.vy
    particle.rotation += particle.rotationSpeed

    // Wrap around screen - sakura petals fall from top
    if (particle.x < -10) particle.x = canvasWidth.value + 10
    if (particle.x > canvasWidth.value + 10) particle.x = -10
    if (particle.y > canvasHeight.value + 10) {
      particle.y = -10
      particle.x = Math.random() * canvasWidth.value
    }
  })
}

function updateObstacles() {
  obstacles.value.forEach(obstacle => {
    // Update horizontal position
    obstacle.x += obstacle.velocityX

    // Bounce off horizontal boundaries
    if (obstacle.x <= obstacle.minX || obstacle.x + obstacle.width >= obstacle.maxX) {
      obstacle.velocityX *= -1
      // Clamp to boundaries
      obstacle.x = Math.max(obstacle.minX, Math.min(obstacle.x, obstacle.maxX - obstacle.width))
    }

    // Update vertical position
    obstacle.y += obstacle.velocityY

    // Bounce off vertical boundaries
    if (obstacle.y <= obstacle.minY || obstacle.y + obstacle.height >= obstacle.maxY) {
      obstacle.velocityY *= -1
      // Clamp to boundaries
      obstacle.y = Math.max(obstacle.minY, Math.min(obstacle.y, obstacle.maxY - obstacle.height))
    }
  })
}

function checkObstacleCollision() {
  const playerLeft = physics.playerPosition.value.x
  const playerRight = physics.playerPosition.value.x + props.settings.playerWidth
  const playerTop = physics.playerPosition.value.y
  const playerBottom = physics.playerPosition.value.y + props.settings.playerHeight

  for (const obstacle of obstacles.value) {
    const obstacleLeft = obstacle.x
    const obstacleRight = obstacle.x + obstacle.width
    const obstacleTop = obstacle.y
    const obstacleBottom = obstacle.y + obstacle.height

    // Check collision
    if (
      playerRight > obstacleLeft &&
      playerLeft < obstacleRight &&
      playerBottom > obstacleTop &&
      playerTop < obstacleBottom
    ) {
      return true
    }
  }

  return false
}

function checkBarrierCollision() {
  const playerLeft = physics.playerPosition.value.x
  const playerRight = physics.playerPosition.value.x + props.settings.playerWidth
  const playerTop = physics.playerPosition.value.y
  const playerBottom = physics.playerPosition.value.y + props.settings.playerHeight

  for (const barrier of barriers.value) {
    const barrierLeft = barrier.x
    const barrierRight = barrier.x + barrier.width
    const barrierTop = barrier.y
    const barrierBottom = barrier.y + barrier.height

    // Check collision
    if (
      playerRight > barrierLeft &&
      playerLeft < barrierRight &&
      playerBottom > barrierTop &&
      playerTop < barrierBottom
    ) {
      // Calculate overlap on each side
      const overlapLeft = playerRight - barrierLeft
      const overlapRight = barrierRight - playerLeft
      const overlapTop = playerBottom - barrierTop
      const overlapBottom = barrierBottom - playerTop

      // Find the smallest overlap (direction of collision)
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

      // Push player back based on collision direction
      if (minOverlap === overlapLeft) {
        // Collision from left - push player left
        physics.playerPosition.value.x = barrierLeft - props.settings.playerWidth - 1
        physics.velocity.value.x = -Math.abs(physics.velocity.value.x) * 0.5
      } else if (minOverlap === overlapRight) {
        // Collision from right - push player right
        physics.playerPosition.value.x = barrierRight + 1
        physics.velocity.value.x = Math.abs(physics.velocity.value.x) * 0.5
      } else if (minOverlap === overlapTop) {
        // Collision from top - push player up (landing on barrier)
        physics.playerPosition.value.y = barrierTop - props.settings.playerHeight
        physics.velocity.value.y = 0
        physics.isJumping.value = false
      } else {
        // Collision from bottom - push player down
        physics.playerPosition.value.y = barrierBottom
        physics.velocity.value.y = Math.abs(physics.velocity.value.y) * 0.3
      }

      return true
    }
  }

  return false
}

function checkCollectiblePickup() {
  const playerLeft = physics.playerPosition.value.x
  const playerRight = physics.playerPosition.value.x + props.settings.playerWidth
  const playerTop = physics.playerPosition.value.y
  const playerBottom = physics.playerPosition.value.y + props.settings.playerHeight

  collectibles.value.forEach(item => {
    if (item.collected) return

    const itemLeft = item.x
    const itemRight = item.x + item.width
    const itemTop = item.y
    const itemBottom = item.y + item.height

    // Check collision with collectible
    if (
      playerRight > itemLeft &&
      playerLeft < itemRight &&
      playerBottom > itemTop &&
      playerTop < itemBottom
    ) {
      item.collected = true

      // If it's a key, open doors that require keys
      if (item.type === 'key') {
        doors.value.forEach(door => {
          if (door.requiresKey) {
            door.isOpen = true
          }
        })
      }

      // If it's a trajectory orb, enable trajectory vision
      if (item.type === 'trajectory_orb') {
        hasTrajectoryVision.value = true
      }
    }
  })
}

function checkDoorCollision() {
  const playerLeft = physics.playerPosition.value.x
  const playerRight = physics.playerPosition.value.x + props.settings.playerWidth
  const playerTop = physics.playerPosition.value.y
  const playerBottom = physics.playerPosition.value.y + props.settings.playerHeight

  for (const door of doors.value) {
    // Skip if door is open
    if (door.isOpen) continue

    const doorLeft = door.x
    const doorRight = door.x + door.width
    const doorTop = door.y
    const doorBottom = door.y + door.height

    // Check collision with closed door (acts as wall)
    if (
      playerRight > doorLeft &&
      playerLeft < doorRight &&
      playerBottom > doorTop &&
      playerTop < doorBottom
    ) {
      return true
    }
  }

  return false
}

function drawParticles() {
  if (!particles.value || particles.value.length === 0) return

  particles.value.forEach(particle => {
    ctx.value.save()
    ctx.value.translate(particle.x, particle.y)
    ctx.value.rotate(particle.rotation)

    // Sakura petal shape (5 petals)
    const petalSize = particle.size
    ctx.value.fillStyle = `rgba(255, 182, 193, ${particle.opacity})` // Light pink

    // Draw 5 petals in a circle
    for (let i = 0; i < 5; i++) {
      ctx.value.save()
      ctx.value.rotate((i * Math.PI * 2) / 5)

      // Single petal (teardrop shape)
      ctx.value.beginPath()
      ctx.value.ellipse(0, -petalSize * 0.5, petalSize * 0.4, petalSize * 0.6, 0, 0, Math.PI * 2)
      ctx.value.fill()

      ctx.value.restore()
    }

    // Center of flower
    ctx.value.fillStyle = `rgba(255, 215, 0, ${particle.opacity * 0.8})` // Golden center
    ctx.value.beginPath()
    ctx.value.arc(0, 0, petalSize * 0.3, 0, Math.PI * 2)
    ctx.value.fill()

    ctx.value.restore()
  })
}

function drawObstacles() {
  if (!obstacles.value || obstacles.value.length === 0) return

  obstacles.value.forEach(obstacle => {
    // Glowing danger effect
    ctx.value.shadowBlur = 15
    ctx.value.shadowColor = '#ef4444'

    // Main obstacle body
    ctx.value.fillStyle = '#dc2626'
    ctx.value.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)

    // Inner glow
    ctx.value.fillStyle = '#fca5a5'
    ctx.value.fillRect(
      obstacle.x + obstacle.width * 0.2,
      obstacle.y + obstacle.height * 0.2,
      obstacle.width * 0.6,
      obstacle.height * 0.6
    )

    ctx.value.shadowBlur = 0

    // Border
    ctx.value.strokeStyle = '#991b1b'
    ctx.value.lineWidth = 2
    ctx.value.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)

    // Animated pulse effect (warning stripes)
    const time = Date.now() / 200
    const pulseOpacity = (Math.sin(time) + 1) / 2 * 0.3 + 0.2
    ctx.value.fillStyle = `rgba(255, 255, 255, ${pulseOpacity})`
    ctx.value.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
  })
}

function drawBarriers() {
  if (!barriers.value || barriers.value.length === 0) return

  barriers.value.forEach(barrier => {
    // Stone wall gradient
    const gradient = ctx.value.createLinearGradient(
      barrier.x, barrier.y,
      barrier.x + barrier.width, barrier.y + barrier.height
    )
    gradient.addColorStop(0, '#6b7280')
    gradient.addColorStop(0.5, '#4b5563')
    gradient.addColorStop(1, '#374151')

    ctx.value.fillStyle = gradient
    ctx.value.fillRect(barrier.x, barrier.y, barrier.width, barrier.height)

    // Stone texture (horizontal lines)
    ctx.value.strokeStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.value.lineWidth = 2
    const numLines = Math.floor(barrier.height / 30)
    for (let i = 1; i <= numLines; i++) {
      const y = barrier.y + (barrier.height / (numLines + 1)) * i
      ctx.value.beginPath()
      ctx.value.moveTo(barrier.x, y)
      ctx.value.lineTo(barrier.x + barrier.width, y)
      ctx.value.stroke()
    }

    // Border
    ctx.value.strokeStyle = '#1f2937'
    ctx.value.lineWidth = 3
    ctx.value.strokeRect(barrier.x, barrier.y, barrier.width, barrier.height)

    // Highlight edge
    ctx.value.strokeStyle = 'rgba(156, 163, 175, 0.4)'
    ctx.value.lineWidth = 2
    ctx.value.beginPath()
    ctx.value.moveTo(barrier.x + 2, barrier.y + 2)
    ctx.value.lineTo(barrier.x + 2, barrier.y + barrier.height - 2)
    ctx.value.stroke()
  })
}

function drawCollectibles() {
  if (!collectibles.value || collectibles.value.length === 0) return

  collectibles.value.forEach(item => {
    if (item.collected) return

    if (item.type === 'key') {
      // Glowing effect
      ctx.value.shadowBlur = 20
      ctx.value.shadowColor = '#fbbf24'

      // Key body
      const time = Date.now() / 300
      const bounce = Math.sin(time) * 3
      const centerX = item.x + item.width / 2
      const centerY = item.y + item.height / 2 + bounce

      // Key shaft
      ctx.value.fillStyle = '#fbbf24'
      ctx.value.fillRect(centerX - 2, centerY - 6, 4, 10)

      // Key head (circle)
      ctx.value.beginPath()
      ctx.value.arc(centerX, centerY - 8, 5, 0, Math.PI * 2)
      ctx.value.fill()

      // Key teeth
      ctx.value.fillRect(centerX + 2, centerY + 2, 3, 2)
      ctx.value.fillRect(centerX + 2, centerY - 1, 3, 2)

      ctx.value.shadowBlur = 0

      // Border
      ctx.value.strokeStyle = '#f59e0b'
      ctx.value.lineWidth = 1.5
      ctx.value.beginPath()
      ctx.value.arc(centerX, centerY - 8, 5, 0, Math.PI * 2)
      ctx.value.stroke()
    } else if (item.type === 'trajectory_orb') {
      // Mystical glowing orb
      const time = Date.now() / 400
      const bounce = Math.sin(time) * 4
      const pulse = Math.sin(time * 2) * 0.3 + 0.7
      const centerX = item.x + item.width / 2
      const centerY = item.y + item.height / 2 + bounce

      // Outer glow
      ctx.value.shadowBlur = 25 * pulse
      ctx.value.shadowColor = '#60a5fa'

      // Orb gradient
      const gradient = ctx.value.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 12
      )
      gradient.addColorStop(0, '#bfdbfe')
      gradient.addColorStop(0.5, '#60a5fa')
      gradient.addColorStop(1, '#3b82f6')

      // Main orb
      ctx.value.fillStyle = gradient
      ctx.value.beginPath()
      ctx.value.arc(centerX, centerY, 10 * pulse, 0, Math.PI * 2)
      ctx.value.fill()

      // Inner sparkle
      ctx.value.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.value.beginPath()
      ctx.value.arc(centerX - 3, centerY - 3, 2, 0, Math.PI * 2)
      ctx.value.fill()

      ctx.value.shadowBlur = 0

      // Rotating ring effect
      ctx.value.strokeStyle = 'rgba(96, 165, 250, 0.5)'
      ctx.value.lineWidth = 2
      ctx.value.beginPath()
      ctx.value.arc(centerX, centerY, 14, time, time + Math.PI)
      ctx.value.stroke()
    }
  })
}

function drawDoors() {
  if (!doors.value || doors.value.length === 0) return

  doors.value.forEach(door => {
    if (door.isOpen) {
      // Open door - don't draw anything
      return
    }

    // Closed/locked door - Japanese wooden gate style
    const woodGradient = ctx.value.createLinearGradient(
      door.x, door.y,
      door.x + door.width, door.y
    )
    woodGradient.addColorStop(0, '#6b4423')
    woodGradient.addColorStop(0.5, '#54341a')
    woodGradient.addColorStop(1, '#6b4423')

    ctx.value.fillStyle = woodGradient
    ctx.value.fillRect(door.x, door.y, door.width, door.height)

    // Vertical planks
    ctx.value.strokeStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.value.lineWidth = 2
    for (let i = 1; i < 3; i++) {
      const x = door.x + (door.width / 3) * i
      ctx.value.beginPath()
      ctx.value.moveTo(x, door.y)
      ctx.value.lineTo(x, door.y + door.height)
      ctx.value.stroke()
    }

    // Metal bands (horizontal)
    ctx.value.strokeStyle = '#3f3f46'
    ctx.value.lineWidth = 3
    const bandPositions = [0.2, 0.5, 0.8]
    bandPositions.forEach(pos => {
      const y = door.y + door.height * pos
      ctx.value.beginPath()
      ctx.value.moveTo(door.x, y)
      ctx.value.lineTo(door.x + door.width, y)
      ctx.value.stroke()
    })

    // Door frame
    ctx.value.strokeStyle = '#8b7355'
    ctx.value.lineWidth = 4
    ctx.value.strokeRect(door.x, door.y, door.width, door.height)

    if (door.requiresKey) {
      // Key symbol emblem on door
      const centerX = door.x + door.width / 2
      const centerY = door.y + door.height / 2

      // Emblem circle background
      ctx.value.fillStyle = 'rgba(30, 30, 30, 0.6)'
      ctx.value.beginPath()
      ctx.value.arc(centerX, centerY, 10, 0, Math.PI * 2)
      ctx.value.fill()

      // Key icon
      ctx.value.fillStyle = '#fbbf24'
      // Key head
      ctx.value.beginPath()
      ctx.value.arc(centerX, centerY - 3, 3, 0, Math.PI * 2)
      ctx.value.fill()
      // Key shaft
      ctx.value.fillRect(centerX - 1, centerY, 2, 6)
      // Key teeth
      ctx.value.fillRect(centerX + 1, centerY + 4, 2, 1)
      ctx.value.fillRect(centerX + 1, centerY + 2, 2, 1)
    }
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
  // Japanese wooden platform style
  const woodGradient = ctx.value.createLinearGradient(
    platform.x, platform.y,
    platform.x, platform.y + platform.height
  )
  woodGradient.addColorStop(0, '#8b6f47') // Light wood
  woodGradient.addColorStop(0.5, '#6b5537') // Medium wood
  woodGradient.addColorStop(1, '#4a3f2a') // Dark wood

  ctx.value.fillStyle = woodGradient
  ctx.value.fillRect(platform.x, platform.y, platform.width, platform.height)

  // Wood grain texture (simple lines)
  ctx.value.strokeStyle = 'rgba(0, 0, 0, 0.15)'
  ctx.value.lineWidth = 1
  for (let i = 0; i < 3; i++) {
    const yPos = platform.y + (platform.height / 4) * (i + 1)
    ctx.value.beginPath()
    ctx.value.moveTo(platform.x, yPos)
    ctx.value.lineTo(platform.x + platform.width, yPos)
    ctx.value.stroke()
  }

  // Top highlight (bamboo edge)
  ctx.value.fillStyle = 'rgba(160, 130, 90, 0.6)'
  ctx.value.fillRect(platform.x, platform.y, platform.width, 2)

  // Border
  ctx.value.strokeStyle = '#3a2f1a'
  ctx.value.lineWidth = 2
  ctx.value.strokeRect(platform.x, platform.y, platform.width, platform.height)
}

function drawPlayer() {
  const x = physics.playerPosition.value.x
  // NINJA CHARACTER v2.0
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

  // Shadow for depth
  ctx.value.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.value.beginPath()
  ctx.value.ellipse(centerX, y + 33 * scale, 7 * scale, 2 * scale, 0, 0, Math.PI * 2)
  ctx.value.fill()

  // Legs (drawn first, behind body)
  ctx.value.fillStyle = '#1a1a2e' // Dark ninja pants
  ctx.value.strokeStyle = '#0a0a1e'
  ctx.value.lineWidth = 1.5 * scale
  ctx.value.lineCap = 'round'

  // Left leg
  ctx.value.beginPath()
  ctx.value.moveTo(centerX - 2 * scale, y + 24 * scale)
  ctx.value.lineTo(centerX - 5 * scale, y + 31 * scale)
  ctx.value.lineWidth = 4 * scale
  ctx.value.stroke()

  // Right leg
  ctx.value.beginPath()
  ctx.value.moveTo(centerX + 2 * scale, y + 24 * scale)
  ctx.value.lineTo(centerX + 5 * scale, y + 31 * scale)
  ctx.value.stroke()

  // Ninja shoes/boots
  ctx.value.fillStyle = '#0a0a1e'
  ctx.value.beginPath()
  ctx.value.arc(centerX - 5 * scale, y + 31 * scale, 2 * scale, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.beginPath()
  ctx.value.arc(centerX + 5 * scale, y + 31 * scale, 2 * scale, 0, Math.PI * 2)
  ctx.value.fill()

  // Body - Ninja suit with gradient
  const bodyGradient = ctx.value.createLinearGradient(
    centerX - 6 * scale, y + 12 * scale,
    centerX + 6 * scale, y + 24 * scale
  )
  bodyGradient.addColorStop(0, '#3b82f6') // Blue
  bodyGradient.addColorStop(1, '#1e40af') // Darker blue
  ctx.value.fillStyle = bodyGradient
  ctx.value.beginPath()
  ctx.value.roundRect(centerX - 6 * scale, y + 12 * scale, 12 * scale, 12 * scale, 2 * scale)
  ctx.value.fill()

  // Body highlights
  ctx.value.fillStyle = 'rgba(147, 197, 253, 0.3)'
  ctx.value.fillRect(centerX - 5 * scale, y + 13 * scale, 3 * scale, 8 * scale)

  // Belt
  ctx.value.fillStyle = '#fbbf24' // Gold belt
  ctx.value.fillRect(centerX - 6 * scale, y + 20 * scale, 12 * scale, 2 * scale)
  ctx.value.fillStyle = '#f59e0b'
  ctx.value.fillRect(centerX - 2 * scale, y + 20 * scale, 4 * scale, 2 * scale) // Belt buckle

  // Arms with gradient
  const armGradient = ctx.value.createLinearGradient(
    centerX - 10 * scale, y + 14 * scale,
    centerX + 10 * scale, y + 22 * scale
  )
  armGradient.addColorStop(0, '#3b82f6')
  armGradient.addColorStop(1, '#1e40af')
  ctx.value.strokeStyle = armGradient
  ctx.value.lineWidth = 3.5 * scale
  ctx.value.lineCap = 'round'

  // Left arm
  ctx.value.beginPath()
  ctx.value.moveTo(centerX - 6 * scale, y + 14 * scale)
  ctx.value.lineTo(centerX - 10 * scale, y + 21 * scale)
  ctx.value.stroke()

  // Right arm
  ctx.value.beginPath()
  ctx.value.moveTo(centerX + 6 * scale, y + 14 * scale)
  ctx.value.lineTo(centerX + 10 * scale, y + 21 * scale)
  ctx.value.stroke()

  // Hands/gloves
  ctx.value.fillStyle = '#1e293b'
  ctx.value.beginPath()
  ctx.value.arc(centerX - 10 * scale, y + 21 * scale, 2 * scale, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.beginPath()
  ctx.value.arc(centerX + 10 * scale, y + 21 * scale, 2 * scale, 0, Math.PI * 2)
  ctx.value.fill()

  // Head - skin tone
  ctx.value.fillStyle = '#fbbf24' // Golden/tan skin
  ctx.value.beginPath()
  ctx.value.arc(centerX, y + 6 * scale, 6 * scale, 0, Math.PI * 2)
  ctx.value.fill()

  // Head outline
  ctx.value.strokeStyle = '#f59e0b'
  ctx.value.lineWidth = 1 * scale
  ctx.value.stroke()

  // Ninja mask/bandana
  ctx.value.fillStyle = '#dc2626' // Red bandana
  ctx.value.beginPath()
  ctx.value.ellipse(centerX, y + 4 * scale, 7 * scale, 4 * scale, 0, 0, Math.PI * 2)
  ctx.value.fill()

  // Bandana knot
  ctx.value.fillStyle = '#dc2626'
  ctx.value.beginPath()
  ctx.value.ellipse(centerX + 6 * scale, y + 4 * scale, 2 * scale, 1.5 * scale, 0, 0, Math.PI * 2)
  ctx.value.fill()

  // Bandana tails
  ctx.value.strokeStyle = '#b91c1c'
  ctx.value.lineWidth = 2 * scale
  ctx.value.lineCap = 'round'
  ctx.value.beginPath()
  ctx.value.moveTo(centerX + 6 * scale, y + 4 * scale)
  ctx.value.lineTo(centerX + 9 * scale, y + 2 * scale)
  ctx.value.stroke()
  ctx.value.beginPath()
  ctx.value.moveTo(centerX + 6 * scale, y + 5 * scale)
  ctx.value.lineTo(centerX + 10 * scale, y + 6 * scale)
  ctx.value.stroke()

  // Face mask (lower part)
  ctx.value.fillStyle = '#1e293b'
  ctx.value.fillRect(centerX - 5 * scale, y + 6 * scale, 10 * scale, 4 * scale)

  // Eyes - fierce ninja eyes
  ctx.value.fillStyle = '#ffffff'
  ctx.value.beginPath()
  ctx.value.ellipse(centerX - 2.5 * scale, y + 5.5 * scale, 2 * scale, 1.5 * scale, 0, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.beginPath()
  ctx.value.ellipse(centerX + 2.5 * scale, y + 5.5 * scale, 2 * scale, 1.5 * scale, 0, 0, Math.PI * 2)
  ctx.value.fill()

  // Pupils - focused look
  ctx.value.fillStyle = '#1e40af'
  ctx.value.beginPath()
  ctx.value.arc(centerX - 2.5 * scale, y + 5.5 * scale, 1 * scale, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.beginPath()
  ctx.value.arc(centerX + 2.5 * scale, y + 5.5 * scale, 1 * scale, 0, Math.PI * 2)
  ctx.value.fill()

  // Eye highlights for life
  ctx.value.fillStyle = '#ffffff'
  ctx.value.beginPath()
  ctx.value.arc(centerX - 2.5 * scale + 0.5 * scale, y + 5.5 * scale - 0.5 * scale, 0.5 * scale, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.beginPath()
  ctx.value.arc(centerX + 2.5 * scale + 0.5 * scale, y + 5.5 * scale - 0.5 * scale, 0.5 * scale, 0, Math.PI * 2)
  ctx.value.fill()

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

  // Add credit text for level 1
  if (props.level && props.level.id === 1) {
    ctx.value.fillStyle = '#10dfb2ff'
    ctx.value.textAlign = 'center'
    ctx.value.textBaseline = 'top'
    ctx.value.shadowBlur = 3
    ctx.value.shadowColor = 'rgba(0, 0, 0, 0.8)'

    // "Created by:" text
    ctx.value.font = `${10 * scale}px "Segoe UI", sans-serif`
    ctx.value.fillText(
      'Created by:',
      goal.x + goal.width + goal.width / 2 + goal.width / 4,
      goal.y + goal.height / 7
    )

    // Names with Satisfy font
    ctx.value.font = `${12 * scale}px "Permanent Marker"`
    ctx.value.fillText(
      'Jozef Barčák & Matúš Belan',
      goal.x + goal.width + goal.width / 2 + goal.width / 4,
      goal.y + goal.height / 2 + goal.height / 6
    )

    ctx.value.shadowBlur = 0
    ctx.value.textAlign = 'start'
    ctx.value.textBaseline = 'alphabetic'
  }
}

function simulateTrajectory(startX, startY, velocityX, velocityY) {
  // Simulate trajectory and return points for drawing
  const points = []
  let x = startX
  let y = startY
  let vx = velocityX
  let vy = velocityY

  // Simulate for max 100 steps or until out of bounds
  const maxSteps = 100
  for (let i = 0; i < maxSteps; i++) {
    // Add point every few frames for dotted appearance
    if (i % 5 === 0) {
      points.push({ x, y })
    }

    // Update velocity (same physics as actual game)
    vy += props.settings.gravity

    // Update position
    x += vx
    y += vy

    // Stop if out of canvas bounds (fell off or too high)
    if (y > canvasHeight.value || y < -100 || x < -100 || x > canvasWidth.value + 100) {
      break
    }

    // Limit number of dots
    if (points.length > 30) {
      break
    }
  }

  return points
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

    // If trajectory vision is active, draw predicted path
    if (hasTrajectoryVision.value) {
      // Calculate jump velocity from drag
      const power = distance * props.settings.dragMultiplier
      const jumpPower = Math.min(power, props.settings.maxJumpPower)
      const velocityX = -Math.cos(angle) * jumpPower
      const velocityY = -Math.sin(angle) * jumpPower

      // Get trajectory points
      const playerCenterX = physics.playerPosition.value.x + props.settings.playerWidth / 2
      const playerCenterY = physics.playerPosition.value.y + props.settings.playerHeight / 2
      const trajectoryPoints = simulateTrajectory(playerCenterX, playerCenterY, velocityX, velocityY)

      // Draw trajectory dots
      ctx.value.fillStyle = 'rgba(96, 165, 250, 0.8)' // Light blue with transparency
      trajectoryPoints.forEach(point => {
        ctx.value.beginPath()
        ctx.value.arc(point.x, point.y, 3, 0, Math.PI * 2)
        ctx.value.fill()
      })
    }

    // Draw subtle dashed arrow line with glow - moonlight white
    ctx.value.shadowBlur = 10
    ctx.value.shadowColor = 'rgba(255, 255, 255, 0.6)'
    ctx.value.strokeStyle = 'rgba(255, 255, 255, 0.75)' // Moonlight white
    ctx.value.lineWidth = 2.5
    ctx.value.lineCap = 'round'
    ctx.value.setLineDash([8, 6]) // Dashed pattern: 8px line, 6px gap
    ctx.value.beginPath()
    ctx.value.moveTo(dragStart.value.x, dragStart.value.y)
    ctx.value.lineTo(endX, endY)
    ctx.value.stroke()
    ctx.value.setLineDash([]) // Reset to solid for other drawings
    ctx.value.shadowBlur = 0

    // Draw subtle arrow head - moonlight white
    const arrowSize = 10
    ctx.value.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.value.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.value.lineWidth = 1.5
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
    ctx.value.stroke()

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

function drawJapaneseHouse(x, y, scale = 1, opacity = 1) {
  // Traditional Japanese house (Machiya style)
  const houseWidth = 30 * scale
  const houseHeight = 20 * scale
  const roofHeight = 12 * scale

  ctx.value.globalAlpha = opacity

  // Main house body
  const bodyGradient = ctx.value.createLinearGradient(
    x - houseWidth / 2, y - houseHeight,
    x + houseWidth / 2, y
  )
  bodyGradient.addColorStop(0, '#3d2817')
  bodyGradient.addColorStop(1, '#2d1810')
  ctx.value.fillStyle = bodyGradient
  ctx.value.fillRect(x - houseWidth / 2, y - houseHeight, houseWidth, houseHeight)

  // Windows with warm light
  ctx.value.fillStyle = '#ffb347'
  const windowWidth = 6 * scale
  const windowHeight = 8 * scale
  // Left window
  ctx.value.fillRect(
    x - houseWidth / 2 + 5 * scale,
    y - houseHeight + 6 * scale,
    windowWidth,
    windowHeight
  )
  // Right window
  ctx.value.fillRect(
    x + houseWidth / 2 - 11 * scale,
    y - houseHeight + 6 * scale,
    windowWidth,
    windowHeight
  )

  // Door
  ctx.value.fillStyle = '#1a0f08'
  ctx.value.fillRect(
    x - 4 * scale,
    y - houseHeight + 8 * scale,
    8 * scale,
    12 * scale
  )

  // Curved roof (Japanese style)
  ctx.value.fillStyle = '#8b4513'
  ctx.value.beginPath()
  ctx.value.moveTo(x - houseWidth / 2 - 5 * scale, y - houseHeight)
  ctx.value.quadraticCurveTo(
    x, y - houseHeight - roofHeight,
    x + houseWidth / 2 + 5 * scale, y - houseHeight
  )
  ctx.value.lineTo(x + houseWidth / 2, y - houseHeight)
  ctx.value.lineTo(x - houseWidth / 2, y - houseHeight)
  ctx.value.closePath()
  ctx.value.fill()

  // Roof edge highlight
  ctx.value.strokeStyle = '#a0522d'
  ctx.value.lineWidth = 1 * scale
  ctx.value.beginPath()
  ctx.value.moveTo(x - houseWidth / 2 - 5 * scale, y - houseHeight)
  ctx.value.quadraticCurveTo(
    x, y - houseHeight - roofHeight,
    x + houseWidth / 2 + 5 * scale, y - houseHeight
  )
  ctx.value.stroke()

  ctx.value.globalAlpha = 1.0
}

function drawPagoda(x, y, scale = 1) {
  // Traditional Japanese Pagoda (5-tiered temple)
  // y is the BOTTOM of the pagoda (where it sits on ground)
  const baseWidth = 60 * scale
  const baseHeight = 12 * scale

  // Pagoda tiers (5 levels) - from bottom to top, widest first
  const tiers = [
    { width: baseWidth, height: baseHeight, roofHeight: 8 * scale },
    { width: baseWidth * 0.85, height: baseHeight, roofHeight: 7 * scale },
    { width: baseWidth * 0.7, height: baseHeight, roofHeight: 6 * scale },
    { width: baseWidth * 0.55, height: baseHeight, roofHeight: 5 * scale },
    { width: baseWidth * 0.4, height: baseHeight * 0.8, roofHeight: 4 * scale }
  ]

  let currentY = y // Start from bottom

  // Draw from bottom to top
  for (let index = 0; index < tiers.length; index++) {
    const tier = tiers[index]
    const tierX = x - tier.width / 2

    // Building body
    currentY -= tier.height
    ctx.value.fillStyle = '#2d1810'
    ctx.value.fillRect(tierX, currentY, tier.width, tier.height)

    // Windows/details
    ctx.value.fillStyle = '#ffd700'
    const numWindows = Math.max(1, Math.floor(tier.width / 25))
    for (let i = 0; i < numWindows; i++) {
      const windowX = tierX + (tier.width / (numWindows + 1)) * (i + 1) - 2 * scale
      const windowY = currentY + tier.height * 0.4
      ctx.value.fillRect(windowX, windowY, 3 * scale, 5 * scale)
    }

    // Roof (curved pagoda style)
    ctx.value.fillStyle = index % 2 === 0 ? '#a0522d' : '#8b4513'
    ctx.value.beginPath()
    ctx.value.moveTo(tierX, currentY)
    ctx.value.lineTo(tierX - tier.width * 0.2, currentY)
    ctx.value.quadraticCurveTo(
      x, currentY - tier.roofHeight,
      tierX + tier.width + tier.width * 0.2, currentY
    )
    ctx.value.lineTo(tierX + tier.width, currentY)
    ctx.value.closePath()
    ctx.value.fill()

    // Roof edge highlight
    ctx.value.strokeStyle = '#d2691e'
    ctx.value.lineWidth = 1.5 * scale
    ctx.value.beginPath()
    ctx.value.moveTo(tierX - tier.width * 0.2, currentY)
    ctx.value.quadraticCurveTo(
      x, currentY - tier.roofHeight,
      tierX + tier.width + tier.width * 0.2, currentY
    )
    ctx.value.stroke()

    currentY -= tier.roofHeight * 0.3 // Small gap between roof and next level
  }

  // Spire on top
  const spireHeight = 12 * scale
  ctx.value.fillStyle = '#ffd700'
  ctx.value.beginPath()
  ctx.value.moveTo(x - 2 * scale, currentY)
  ctx.value.lineTo(x, currentY - spireHeight)
  ctx.value.lineTo(x + 2 * scale, currentY)
  ctx.value.closePath()
  ctx.value.fill()

  // Decorative ball on top of spire
  ctx.value.fillStyle = '#ffd700'
  ctx.value.beginPath()
  ctx.value.arc(x, currentY - spireHeight, 3 * scale, 0, Math.PI * 2)
  ctx.value.fill()

  // Decorative rings on spire
  for (let i = 0; i < 2; i++) {
    ctx.value.strokeStyle = '#ffd700'
    ctx.value.lineWidth = 1.5 * scale
    ctx.value.beginPath()
    ctx.value.ellipse(
      x,
      currentY - 3 * scale - i * 3 * scale,
      3 * scale,
      1.5 * scale,
      0, 0, Math.PI * 2
    )
    ctx.value.stroke()
  }
}

function drawJapaneseBackground() {
  // Sky gradient - traditional Japanese sunset/evening colors
  const skyGradient = ctx.value.createLinearGradient(0, 0, 0, canvasHeight.value)
  skyGradient.addColorStop(0, '#1a1a40') // Deep purple night
  skyGradient.addColorStop(0.3, '#2d3561') // Twilight blue
  skyGradient.addColorStop(0.6, '#4a5568') // Evening gray
  skyGradient.addColorStop(1, '#2d3748') // Dark base
  ctx.value.fillStyle = skyGradient
  ctx.value.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Moon
  ctx.value.shadowBlur = 30
  ctx.value.shadowColor = '#f7fafc'
  ctx.value.fillStyle = '#f7fafc'
  ctx.value.beginPath()
  ctx.value.arc(canvasWidth.value * 0.85, canvasHeight.value * 0.15, 30, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.shadowBlur = 0

  // Distant mountains - Mount Fuji style (3 layers for depth)
  // Far mountains (lightest)
  ctx.value.fillStyle = 'rgba(71, 85, 105, 0.4)'
  ctx.value.beginPath()
  ctx.value.moveTo(0, canvasHeight.value * 0.6)
  ctx.value.lineTo(canvasWidth.value * 0.3, canvasHeight.value * 0.35)
  ctx.value.lineTo(canvasWidth.value * 0.6, canvasHeight.value * 0.55)
  ctx.value.lineTo(canvasWidth.value, canvasHeight.value * 0.55)
  ctx.value.lineTo(canvasWidth.value, canvasHeight.value)
  ctx.value.lineTo(0, canvasHeight.value)
  ctx.value.closePath()
  ctx.value.fill()

  // Pagoda on the far mountain peak
  ctx.value.globalAlpha = 0.5
  const farPagodaX = canvasWidth.value * 0.3
  const farPagodaY = canvasHeight.value * 0.38
  drawPagoda(farPagodaX, farPagodaY, 0.6)
  ctx.value.globalAlpha = 1.0

  // Village houses clustered around far pagoda (below it)
  drawJapaneseHouse(farPagodaX - 25, farPagodaY + 15, 0.35, 0.4)
  drawJapaneseHouse(farPagodaX + 20, farPagodaY + 12, 0.38, 0.4)
  drawJapaneseHouse(farPagodaX - 10, farPagodaY + 28, 0.32, 0.4)
  drawJapaneseHouse(farPagodaX + 35, farPagodaY + 25, 0.36, 0.4)
  drawJapaneseHouse(farPagodaX - 40, farPagodaY + 22, 0.33, 0.4)

  // Middle mountains
  ctx.value.fillStyle = 'rgba(51, 65, 85, 0.5)'
  ctx.value.beginPath()
  ctx.value.moveTo(0, canvasHeight.value * 0.7)
  ctx.value.lineTo(canvasWidth.value * 0.5, canvasHeight.value * 0.45)
  ctx.value.lineTo(canvasWidth.value * 0.8, canvasHeight.value * 0.6)
  ctx.value.lineTo(canvasWidth.value, canvasHeight.value * 0.65)
  ctx.value.lineTo(canvasWidth.value, canvasHeight.value)
  ctx.value.lineTo(0, canvasHeight.value)
  ctx.value.closePath()
  ctx.value.fill()

  // Pagoda on middle mountain peak
  ctx.value.globalAlpha = 0.7
  const midPagodaX = canvasWidth.value * 0.5
  const midPagodaY = canvasHeight.value * 0.5
  drawPagoda(midPagodaX, midPagodaY, 0.9)
  ctx.value.globalAlpha = 1.0

  // Village houses clustered around middle pagoda (below it)
  drawJapaneseHouse(midPagodaX - 45, midPagodaY + 22, 0.48, 0.6)
  drawJapaneseHouse(midPagodaX + 38, midPagodaY + 18, 0.52, 0.6)
  drawJapaneseHouse(midPagodaX - 20, midPagodaY + 40, 0.45, 0.6)
  drawJapaneseHouse(midPagodaX + 15, midPagodaY + 38, 0.50, 0.6)
  drawJapaneseHouse(midPagodaX - 65, midPagodaY + 35, 0.46, 0.6)
  drawJapaneseHouse(midPagodaX + 55, midPagodaY + 35, 0.47, 0.6)
  drawJapaneseHouse(midPagodaX, midPagodaY + 52, 0.43, 0.6)

  // Near mountains (darkest)
  ctx.value.fillStyle = 'rgba(30, 41, 59, 0.7)'
  ctx.value.beginPath()
  ctx.value.moveTo(0, canvasHeight.value * 0.8)
  ctx.value.lineTo(canvasWidth.value * 0.25, canvasHeight.value * 0.6)
  ctx.value.lineTo(canvasWidth.value * 0.7, canvasHeight.value * 0.7)
  ctx.value.lineTo(canvasWidth.value, canvasHeight.value * 0.75)
  ctx.value.lineTo(canvasWidth.value, canvasHeight.value)
  ctx.value.lineTo(0, canvasHeight.value)
  ctx.value.closePath()
  ctx.value.fill()

  // Village on near mountains (left side cluster)
  const nearVillageX1 = canvasWidth.value * 0.25
  const nearVillageY1 = canvasHeight.value * 0.6
  drawJapaneseHouse(nearVillageX1 - 30, nearVillageY1 + 20, 0.58, 0.75)
  drawJapaneseHouse(nearVillageX1 + 25, nearVillageY1 + 18, 0.62, 0.75)
  drawJapaneseHouse(nearVillageX1 - 10, nearVillageY1 + 38, 0.55, 0.75)
  drawJapaneseHouse(nearVillageX1 + 45, nearVillageY1 + 35, 0.60, 0.75)
  drawJapaneseHouse(nearVillageX1 - 50, nearVillageY1 + 32, 0.56, 0.75)

  // Village on near mountains (right side cluster)
  const nearVillageX2 = canvasWidth.value * 0.7
  const nearVillageY2 = canvasHeight.value * 0.7
  drawJapaneseHouse(nearVillageX2 - 35, nearVillageY2 + 15, 0.57, 0.75)
  drawJapaneseHouse(nearVillageX2 + 20, nearVillageY2 + 12, 0.61, 0.75)
  drawJapaneseHouse(nearVillageX2 - 15, nearVillageY2 + 32, 0.59, 0.75)
  drawJapaneseHouse(nearVillageX2 + 40, nearVillageY2 + 28, 0.54, 0.75)
  drawJapaneseHouse(nearVillageX2, nearVillageY2 + 45, 0.56, 0.75)
}

function draw() {
  // Clear canvas
  ctx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Japanese themed background
  drawJapaneseBackground()

  // Draw sakura petals
  drawParticles()

  // Draw start flag
  drawStartFlag()

  // Draw platforms
  props.level.platforms.forEach(platform => drawPlatform(platform, '#3a3a4e'))

  // Draw barriers (stone walls)
  drawBarriers()

  // Draw obstacles
  drawObstacles()

  // Draw doors
  drawDoors()

  // Draw collectibles (keys)
  drawCollectibles()

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

    // Update obstacles
    updateObstacles()

    // Update physics
    const status = physics.updatePhysics(props.level.platforms, canvasHeight.value)

    if (status === 'fell') {
      emit('player-fell')
      // Reset player to start position
      physics.setPosition(props.level.startPosition.x, props.level.startPosition.y)
      physics.startFalling()
      initObstacles() // Reset obstacles when player falls
      initCollectibles() // Reset collectibles
      initDoors() // Reset doors
      hasTrajectoryVision.value = false // Reset trajectory vision when player dies
    }

    // Check obstacle collision
    if (checkObstacleCollision()) {
      emit('player-fell')
      // Reset player to start position
      physics.setPosition(props.level.startPosition.x, props.level.startPosition.y)
      physics.startFalling()
      initObstacles() // Reset obstacles when hit
      initCollectibles() // Reset collectibles when player dies
      initDoors() // Reset doors when player dies
      hasTrajectoryVision.value = false // Reset trajectory vision when player dies
    }

    // Check barrier collision (stone walls) - just bounce, don't reset
    checkBarrierCollision()

    // Check door collision (closed doors act as walls)
    if (checkDoorCollision()) {
      emit('player-fell')
      // Reset player to start position
      physics.setPosition(props.level.startPosition.x, props.level.startPosition.y)
      physics.startFalling()
      initObstacles()
      initCollectibles()
      initDoors()
      hasTrajectoryVision.value = false // Reset trajectory vision when player dies
    }

    // Check collectible pickup (keys)
    checkCollectiblePickup()

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
  initObstacles()
  initBarriers()
  initCollectibles()
  initDoors()
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
