import { ref, computed, onMounted, onUnmounted } from 'vue'

export function useResponsiveCanvas() {
  // Base dimensions (original design size)
  const BASE_WIDTH = 1000
  const BASE_HEIGHT = 750

  // Window dimensions
  const windowWidth = ref(window.innerWidth)
  const windowHeight = ref(window.innerHeight)

  // Calculate canvas dimensions - true fullscreen
  const canvasDimensions = computed(() => {
    // Canvas fills entire viewport - no aspect ratio constraints
    return {
      width: Math.floor(windowWidth.value),
      height: Math.floor(windowHeight.value)
    }
  })

  // Scale factor for positions and sizes
  const scale = computed(() => ({
    x: canvasDimensions.value.width / BASE_WIDTH,
    y: canvasDimensions.value.height / BASE_HEIGHT
  }))

  // Function to scale a level's platforms and positions
  function scaleLevel(level) {
    if (!level) return null

    return {
      ...level,
      platforms: level.platforms.map(platform => ({
        x: platform.x * scale.value.x,
        y: platform.y * scale.value.y,
        width: platform.width * scale.value.x,
        height: platform.height * scale.value.y
      })),
      goal: {
        x: level.goal.x * scale.value.x,
        y: level.goal.y * scale.value.y,
        width: level.goal.width * scale.value.x,
        height: level.goal.height * scale.value.y
      },
      startPosition: {
        x: level.startPosition.x * scale.value.x,
        y: level.startPosition.y * scale.value.y
      }
    }
  }

  // Function to scale game settings
  function scaleSettings(settings) {
    // Use larger scale dimension for consistent scaling
    const maxScale = Math.max(scale.value.x, scale.value.y)
    // Scale proportionally on all screen sizes (no minimum)
    const powerScale = maxScale * 1.5

    return {
      ...settings,
      canvasWidth: canvasDimensions.value.width,
      canvasHeight: canvasDimensions.value.height,
      // Scale player dimensions to match scaled platforms
      playerWidth: settings.playerWidth * scale.value.x,
      playerHeight: settings.playerHeight * scale.value.y,
      // Scale gravity to maintain consistent physics across screen sizes
      gravity: settings.gravity * scale.value.y,
      // Both drag distance and power scale the same for consistent percentages
      maxDragDistance: settings.maxDragDistance * powerScale,
      maxJumpPower: settings.maxJumpPower * powerScale,
      dragMultiplier: settings.dragMultiplier  // Keep multiplier constant
    }
  }

  // Handle window resize
  function handleResize() {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    canvasDimensions,
    scale,
    scaleLevel,
    scaleSettings
  }
}
