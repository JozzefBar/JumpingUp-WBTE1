<template>
  <div id="app" :class="{ 'game-active': gameStarted }">
    <!-- Rotate Device Prompt -->
    <RotateDevice />

    <!-- Start Screen -->
    <div v-if="!gameStarted" class="start-screen">
      <canvas ref="startCanvas" class="start-canvas"></canvas>
      <div class="start-content">
        <h1>🏔️ {{ gameInfo.name }}</h1>
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
          :is-paused="isGamePaused"
          @goal-reached="handleGoalReached"
          @player-fell="handlePlayerFell"
          @jump="handleJump"
          @drag-start="handleDragStart"
          @drag-end="handleDragEnd"
        />
      </div>

      <!-- HUD Overlay - Minimalist corners -->
      <div class="game-hud-overlay" :class="{ 'dragging': isDraggingPower }">
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

        <!-- Bottom Right: Pause and Restart buttons -->
        <div class="hud-corner bottom-right">
          <div class="button-group">
            <button @click="togglePause" class="menu-button">{{ isPaused ? '▶' : '⏸' }}</button>
            <button @click="restartLevel" class="menu-button menu-button-black">↻</button>
          </div>
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
      :game-info="gameInfo"
      :stats="stats.getStats()"
      :format-time="stats.formatTime"
      :has-saved-game="hasSavedGame"
      @close="showMenu = false"
      @start="startGame"
      @continue-game="continueGame"
      @resume="showMenu = false"
      @restart="restartGame"
      @select-level="goToLevel"
    />

    <!-- Level Complete Overlay -->
    <LevelComplete
      v-if="showLevelComplete"
      :level-name="completedLevelName"
      :attempts="completionStats.deaths"
      :jumps="completionStats.jumps"
      :time="completionStats.time"
      :has-next-level="hasNextLevel"
      :format-time="stats.formatTime"
      @next-level="goToNextLevel"
      @restart="replayCurrentLevel"
      @menu="handleMenuFromComplete"
    />

    <!-- Print Section -->
    <div class="print-section">
      <h1>🏔️ {{ gameInfo.name }}</h1>

      <div class="game-description-print">
        <p class="description-text">{{ gameInfo.description }}</p>
        <p class="objective-text"><strong>Cieľ:</strong> {{ gameInfo.objective }}</p>
      </div>

      <h2>Ako hrať</h2>
      <div class="instructions">
        <ol>
          <li v-for="(step, index) in instructions.steps" :key="index">
            {{ step }}
          </li>
        </ol>
      </div>

      <h2>Tipy</h2>
      <div class="instructions">
        <ul>
          <li v-for="(tip, index) in instructions.tips" :key="index">
            {{ tip }}
          </li>
        </ul>
      </div>

      <template v-if="gameStarted">
        <h2>Štatistiky</h2>

        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-number">{{ stats.totalDeaths }}</div>
            <div class="stat-label">Celkový počet pokusov</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{{ stats.totalJumps }}</div>
            <div class="stat-label">Celkový počet skokov</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{{ stats.completedLevels.value.length }}</div>
            <div class="stat-label">Dokončené levely</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">{{ stats.formatTime(stats.totalTime.value) }}</div>
            <div class="stat-label">Celkový čas</div>
          </div>
        </div>

        <h2 v-if="stats.completedLevels.value.length > 0">História levelov</h2>
        <div v-if="stats.completedLevels.value.length > 0" class="history-table">
          <div class="history-header">
            <div>Level</div>
            <div>Názov</div>
            <div>Pokusy</div>
            <div>Skoky</div>
            <div>Čas</div>
          </div>
          <div v-for="(level, index) in stats.completedLevels.value" :key="index" class="history-row">
            <div>{{ level.levelId }}</div>
            <div>{{ level.name }}</div>
            <div>{{ level.deaths }}</div>
            <div>{{ level.jumps }}</div>
            <div>{{ stats.formatTime(level.time) }} <span v-if="isBestTime(level)" style="color: #fbbf24;">🏆</span></div>
          </div>
        </div>
      </template>

      <div class="footer">
        <p>{{ gameInfo.name }} - PWA Hra</p>
        <p>Vytlačené: {{ new Date().toLocaleDateString('sk-SK') }}</p>
      </div>
    </div>
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
import settingsData from './data/settings.json'

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
const baseGameSettings = settingsData.gameSettings
const instructions = settingsData.instructions
const gameInfo = settingsData.gameInfo

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
  return gameStarted.value ? 'Menu' : gameInfo.name
})

const formattedElapsedTime = computed(() => {
  // Priamo pristupuj k .value ako v menu
  return stats.formatTime(stats.elapsedTime.value || 0)
})

// Game is paused when isPaused is true OR menu is open
const isGamePaused = computed(() => isPaused.value || showMenu.value)

// Track dragging state
const isDraggingPower = ref(false)

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
  isPaused.value = false  // Unpause when restarting
  stats.resetLevel()
  levelRestartKey.value++
  // Use nextTick to ensure component is ready after key change
  setTimeout(() => {
    if (gameCanvas.value) {
      gameCanvas.value.resetPlayer()
    }
  }, 50)
}

function replayCurrentLevel() {
  // Continue playing the same level after completion (Hrať znova button)
  // Stats continue accumulating
  showLevelComplete.value = false
  stats.continueCurrentLevel()
  levelRestartKey.value++
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

function handleDragStart() {
  isDraggingPower.value = true
}

function handleDragEnd() {
  isDraggingPower.value = false
}

function handleGoalReached() {
  const completion = stats.completeLevel(currentLevel.value.name)
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

// Determine if a level completion has the best time for that level
function isBestTime(level) {
  // Get all completions for this level
  const levelCompletions = stats.completedLevels.value.filter(l => l.levelId === level.levelId)

  if (levelCompletions.length === 0) return false

  // Find the minimum time for this level
  const minTime = Math.min(...levelCompletions.map(l => l.time))

  // Check if this level's time matches the minimum
  return level.time === minTime
}

// Start screen particles
// Cap DPR at 2 for better performance on high-DPI displays
const startCanvasDpr = Math.min(window.devicePixelRatio || 1, 2)
const logicalWidth = ref(window.innerWidth)
const logicalHeight = ref(window.innerHeight)

function initStartParticles() {
  if (!startCanvas.value) return

  const canvas = startCanvas.value
  logicalWidth.value = window.innerWidth
  logicalHeight.value = window.innerHeight

  // Set canvas size for high-DPI displays
  canvas.width = Math.floor(logicalWidth.value * startCanvasDpr)
  canvas.height = Math.floor(logicalHeight.value * startCanvasDpr)

  // Set CSS size to logical dimensions
  canvas.style.width = `${logicalWidth.value}px`
  canvas.style.height = `${logicalHeight.value}px`

  // Scale context for DPR
  const ctx = canvas.getContext('2d')
  ctx.scale(startCanvasDpr, startCanvasDpr)

  startParticles.value = []
  const numParticles = 40
  for (let i = 0; i < numParticles; i++) {
    startParticles.value.push({
      x: Math.random() * logicalWidth.value,
      y: Math.random() * logicalHeight.value,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.1
    })
  }
}

function updateStartParticles() {
  if (!startCanvas.value) return

  startParticles.value.forEach(particle => {
    particle.x += particle.vx
    particle.y += particle.vy

    if (particle.x < 0) particle.x = logicalWidth.value
    if (particle.x > logicalWidth.value) particle.x = 0
    if (particle.y < 0) particle.y = logicalHeight.value
    if (particle.y > logicalHeight.value) particle.y = 0
  })
}

function drawStartParticles() {
  if (!startCanvas.value) return

  const canvas = startCanvas.value
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, logicalWidth.value, logicalHeight.value)

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
      // Only resume if the game is not paused by the user
      if (!isPaused.value) {
        stats.resumeTimer()
      }
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

// Handle print dialog - pause game when printing
let wasPausedBeforePrint = false

function handleBeforePrint() {
  if (gameStarted.value && !isPaused.value && !showMenu.value && !showLevelComplete.value) {
    wasPausedBeforePrint = false
    isPaused.value = true
  } else {
    wasPausedBeforePrint = true
  }
}

function handleAfterPrint() {
  if (gameStarted.value && !wasPausedBeforePrint) {
    isPaused.value = false
  }
}

// Handle window visibility - pause when minimized or alt-tabbed
function handleVisibilityChange() {
  if (document.hidden) {
    // Page is hidden (minimized, alt-tabbed, etc.)
    if (gameStarted.value && !isPaused.value && !showMenu.value && !showLevelComplete.value) {
      isPaused.value = true
    }
  }
  // Don't auto-resume when page becomes visible - let user manually resume
}

// Handle keyboard shortcuts
function handleKeyPress(event) {
  // Space key toggles pause during gameplay
  if (event.code === 'Space' && gameStarted.value && !showMenu.value && !showLevelComplete.value) {
    event.preventDefault() // Prevent page scrolling
    togglePause()
  }
}

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

  // Add print dialog event listeners
  window.addEventListener('beforeprint', handleBeforePrint)
  window.addEventListener('afterprint', handleAfterPrint)

  // Add visibility change listener - pause when window loses focus
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Add keyboard shortcuts listener
  window.addEventListener('keydown', handleKeyPress)

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
  // Remove print dialog event listeners
  window.removeEventListener('beforeprint', handleBeforePrint)
  window.removeEventListener('afterprint', handleAfterPrint)
  // Remove visibility change listener
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  // Remove keyboard shortcuts listener
  window.removeEventListener('keydown', handleKeyPress)
})
</script>

<style src="./css/main.css"></style>
<style src="./css/print-game.css"></style>
