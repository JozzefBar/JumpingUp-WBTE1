<template>
  <div id="app" :class="{ 'game-active': gameStarted }">
    <!-- Rotate Device Prompt -->
    <RotateDevice />

    <!-- Start Screen -->
    <div v-if="!gameStarted" class="start-screen">
      <canvas ref="startCanvas" class="start-canvas"></canvas>
      <div class="start-content">
        <h1>🏔️ Jumping Up</h1>
        <p>Vyšplhaj sa na vrchol veže pomocou presných skokov.</p>
        <button v-if="hasSavedGame" @click="continueGame" class="btn btn-large btn-primary">Pokračovať</button>
        <button @click="startGame" class="btn btn-large" :class="hasSavedGame ? 'btn-secondary' : 'btn-primary'">Začať novú hru</button>
        <button @click="showMenu = true" class="btn btn-large btn-secondary">Návod</button>
      </div>
    </div>

    <!-- Game Screen (Fullscreen) -->
    <div v-else class="game-screen">
      <!-- Game Canvas - Fullscreen -->
      <div class="game-canvas-wrapper">
        <GameCanvas
          v-if="currentLevel"
          :key="`${currentLevelIndex}-${levelRestartKey}`"
          ref="gameCanvas"
          :level="currentLevel"
          :settings="gameSettings"
          :is-paused="isPaused"
          @goal-reached="handleGoalReached"
          @player-fell="handlePlayerFell"
          @jump="handleJump"
        />
      </div>

      <!-- HUD Overlay - Minimalist corners -->
      <div class="game-hud-overlay">
        <!-- Top Left: Level info -->
        <div class="hud-corner top-left">
          <div class="hud-text">Level {{ stats.currentLevel }}</div>
          <div class="hud-text-small">{{ currentLevel?.name }}</div>
        </div>

        <!-- Top Right: Menu button -->
        <div class="hud-corner top-right">
          <button @click="toggleMenu" class="menu-button">☰</button>
        </div>

        <!-- Bottom Left: Stats -->
        <div class="hud-corner bottom-left">
          <div class="hud-stat-line">Pokusy: {{ stats.deaths }}</div>
          <div class="hud-stat-line">Skoky: {{ stats.jumps }}</div>
          <div class="hud-stat-line">Čas: {{ formattedElapsedTime }}</div>
        </div>

        <!-- Bottom Right: Pause button -->
        <div class="hud-corner bottom-right">
          <button @click="togglePause" class="menu-button">{{ isPaused ? '▶' : '⏸' }}</button>
        </div>

        <!-- Pause Indicator -->
        <div v-if="isPaused" class="pause-indicator">
          <div class="pause-text">⏸ PAUZA</div>
        </div>
      </div>
    </div>

    <!-- Menu Overlay -->
    <GameMenu
      v-if="showMenu"
      :title="menuTitle"
      :show-instructions="true"
      :show-stats="gameStarted"
      :show-resume="gameStarted && !showLevelComplete"
      :show-start="!gameStarted"
      :show-restart="gameStarted"
      :show-level-selector="gameStarted"
      :total-levels="levels.length"
      :current-level="currentLevelIndex + 1"
      :instructions="instructions"
      :stats="stats.getStats()"
      :format-time="stats.formatTime"
      @close="showMenu = false"
      @start="startGame"
      @resume="showMenu = false"
      @restart="restartGame"
      @select-level="goToLevel"
    />

    <!-- Level Complete Overlay -->
    <LevelComplete
      v-if="showLevelComplete"
      :level-name="completedLevelName"
      :attempts="completionStats.deaths"
      :time="completionStats.time"
      :has-next-level="hasNextLevel"
      :format-time="stats.formatTime"
      @next-level="goToNextLevel"
      @restart="restartLevel"
      @menu="handleMenuFromComplete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import GameCanvas from './components/GameCanvas.vue'
import GameMenu from './components/GameMenu.vue'
import LevelComplete from './components/LevelComplete.vue'
import RotateDevice from './components/RotateDevice.vue'
import { useGameStats } from './composables/useGameStats'
import { useResponsiveCanvas } from './composables/useResponsiveCanvas'
import levelsData from './data/levels.json'

// Game state
const gameStarted = ref(false)
const showMenu = ref(false)
const showLevelComplete = ref(false)
const isPaused = ref(false)
const currentLevelIndex = ref(0)
const levelRestartKey = ref(0)
const gameCanvas = ref(null)
const startCanvas = ref(null)
const completionStats = ref({ deaths: 0, jumps: 0, time: 0 })
const completedLevelName = ref('')
const hasSavedGame = ref(false)

// Start screen particles
const startParticles = ref([])
let startAnimationFrame = null

// Game data
const levels = levelsData.levels
const baseGameSettings = levelsData.gameSettings
const instructions = levelsData.instructions

// Stats
const stats = useGameStats()

// Responsive canvas
const responsive = useResponsiveCanvas()

// Computed
const currentLevel = computed(() => {
  const level = levels[currentLevelIndex.value] || null
  return responsive.scaleLevel(level)
})

const gameSettings = computed(() => {
  return responsive.scaleSettings(baseGameSettings)
})

const hasNextLevel = computed(() => {
  return currentLevelIndex.value < levels.length - 1
})

const menuTitle = computed(() => {
  return gameStarted.value ? 'Pauza' : 'Jumping Up'
})

const formattedElapsedTime = computed(() => {
  // Priamo pristupuj k .value ako v menu
  return stats.formatTime(stats.elapsedTime.value || 0)
})

function startGame() {
  gameStarted.value = true
  showMenu.value = false
  currentLevelIndex.value = 0
  stats.resetStats()
  stats.startLevel(currentLevel.value.id)
  hasSavedGame.value = false
}

function continueGame() {
  gameStarted.value = true
  showMenu.value = false
  // Load saved level from stats (currentLevel is 1-indexed, array is 0-indexed)
  currentLevelIndex.value = stats.currentLevel.value - 1
  // Resume timer without resetting stats
  stats.resumeLevel()
}

function restartGame() {
  showMenu.value = false
  showLevelComplete.value = false
  currentLevelIndex.value = 0
  levelRestartKey.value++
  stats.resetStats()
  stats.startLevel(currentLevel.value.id)
  hasSavedGame.value = false
  setTimeout(() => {
    if (gameCanvas.value) {
      gameCanvas.value.resetPlayer()
    }
  }, 50)
}

function restartLevel() {
  showLevelComplete.value = false
  stats.resetLevel()
  levelRestartKey.value++
  // Use nextTick to ensure component is ready after key change
  setTimeout(() => {
    if (gameCanvas.value) {
      gameCanvas.value.resetPlayer()
    }
  }, 50)
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function togglePause() {
  isPaused.value = !isPaused.value
}

function handleJump() {
  stats.recordJump()
}

function handleGoalReached() {
  const completion = stats.completeLevel()
  completionStats.value = completion
  completedLevelName.value = currentLevel.value.name
  showLevelComplete.value = true
}

function handlePlayerFell() {
  stats.recordDeath()
  // Player will be reset automatically by GameCanvas
}

function goToNextLevel() {
  if (hasNextLevel.value) {
    currentLevelIndex.value++
    showLevelComplete.value = false
    stats.startLevel(currentLevel.value.id)
    setTimeout(() => {
      if (gameCanvas.value) {
        gameCanvas.value.resetPlayer()
      }
    }, 50)
  }
}

function handleMenuFromComplete() {
  showLevelComplete.value = false
  showMenu.value = true
}

function goToLevel(levelId) {
  // levelId is 1-indexed, array is 0-indexed
  currentLevelIndex.value = levelId - 1
  showMenu.value = false
  showLevelComplete.value = false
  stats.startLevel(levelId)
  setTimeout(() => {
    if (gameCanvas.value) {
      gameCanvas.value.resetPlayer()
    }
  }, 50)
}

// Start screen particles
function initStartParticles() {
  if (!startCanvas.value) return

  const canvas = startCanvas.value
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  startParticles.value = []
  const numParticles = 40
  for (let i = 0; i < numParticles; i++) {
    startParticles.value.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.1
    })
  }
}

function updateStartParticles() {
  if (!startCanvas.value) return

  const canvas = startCanvas.value
  startParticles.value.forEach(particle => {
    particle.x += particle.vx
    particle.y += particle.vy

    if (particle.x < 0) particle.x = canvas.width
    if (particle.x > canvas.width) particle.x = 0
    if (particle.y < 0) particle.y = canvas.height
    if (particle.y > canvas.height) particle.y = 0
  })
}

function drawStartParticles() {
  if (!startCanvas.value) return

  const canvas = startCanvas.value
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  startParticles.value.forEach(particle => {
    ctx.fillStyle = `rgba(232, 232, 232, ${particle.opacity})`
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
    ctx.fill()
  })
}

function startParticleLoop() {
  updateStartParticles()
  drawStartParticles()
  startAnimationFrame = requestAnimationFrame(startParticleLoop)
}

function stopStartParticles() {
  if (startAnimationFrame) {
    cancelAnimationFrame(startAnimationFrame)
    startAnimationFrame = null
  }
}

// Watch for menu/level complete overlay and pause/resume timer
watch(showMenu, (isOpen) => {
  if (gameStarted.value) {
    if (isOpen) {
      stats.pauseTimer()
    } else {
      stats.resumeTimer()
    }
  }
})

watch(showLevelComplete, (isOpen) => {
  if (isOpen) {
    stats.pauseTimer()
  }
})

watch(isPaused, (paused) => {
  if (gameStarted.value) {
    if (paused) {
      stats.pauseTimer()
    } else {
      stats.resumeTimer()
    }
  }
})

// Watch gameStarted to start/stop particles
watch(gameStarted, (started) => {
  if (started) {
    stopStartParticles()
  } else {
    setTimeout(() => {
      initStartParticles()
      startParticleLoop()
    }, 50)
  }
})

// Register service worker for PWA
onMounted(() => {
  // Check for saved game
  hasSavedGame.value = stats.hasSavedGame()

  // Initialize start screen particles
  if (!gameStarted.value) {
    setTimeout(() => {
      initStartParticles()
      startParticleLoop()
    }, 100)
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.log('Service Worker registration failed:', err))
  }
})

// Cleanup timer and particles on unmount
onUnmounted(() => {
  stats.pauseTimer()
  stopStartParticles()
})
</script>

<style src="./css/main.css"></style>
