<template>
  <div id="app" :class="{ 'game-active': gameStarted }">
    <!-- Rotate Device Prompt -->
    <RotateDevice />

    <!-- Start Screen -->
    <div v-if="!gameStarted" class="start-screen">
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
      :instructions="instructions"
      :stats="stats.getStats()"
      :format-time="stats.formatTime"
      @close="showMenu = false"
      @start="startGame"
      @resume="showMenu = false"
      @restart="restartGame"
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
const currentLevelIndex = ref(0)
const levelRestartKey = ref(0)
const gameCanvas = ref(null)
const completionStats = ref({ deaths: 0, jumps: 0, time: 0 })
const completedLevelName = ref('')
const hasSavedGame = ref(false)

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

// Register service worker for PWA
onMounted(() => {
  // Check for saved game
  hasSavedGame.value = stats.hasSavedGame()

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.log('Service Worker registration failed:', err))
  }
})

// Cleanup timer on unmount
onUnmounted(() => {
  stats.pauseTimer()
})
</script>

<style src="./css/main.css"></style>

<style scoped>
/* Fullscreen Game Layout */
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

#app.game-active {
  height: 100vh;
  overflow: hidden;
}

/* Start Screen */
.start-screen {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  padding: 20px;
}

.start-content {
  text-align: center;
  max-width: 600px;
  background: rgba(26, 26, 46, 0.8);
  padding: 60px 40px;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(232, 232, 232, 0.1);
  backdrop-filter: blur(10px);
}

.start-content h1 {
  font-size: 48px;
  color: #e8e8e8;
  margin-bottom: 20px;
  text-shadow: 0 0 20px rgba(232, 232, 232, 0.3);
}

.start-content p {
  font-size: 20px;
  color: #b8b8c8;
  margin-bottom: 40px;
  line-height: 1.6;
}

/* Game Screen - Fullscreen */
.game-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* Canvas Wrapper - Fullscreen */
.game-canvas-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
}

/* HUD Overlay - Minimalist */
.game-hud-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 100;
}

.game-hud-overlay > * {
  pointer-events: auto;
}

/* Corner positioning */
.hud-corner {
  position: absolute;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  backdrop-filter: blur(3px);
}

.top-left {
  top: 12px;
  left: 12px;
}

.top-right {
  top: 12px;
  right: 12px;
}

.bottom-left {
  bottom: 12px;
  left: 12px;
}

.bottom-right {
  bottom: 12px;
  right: 12px;
}

/* HUD Text - Small and subtle */
.hud-text {
  font-size: 13px;
  color: #4ade80;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  margin-bottom: 2px;
}

.hud-text-small {
  font-size: 11px;
  color: #e8e8e8;
  font-weight: 500;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.hud-stat-line {
  font-size: 12px;
  color: #e8e8e8;
  font-weight: 500;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  margin: 2px 0;
}

/* Menu button - Small */
.menu-button {
  background: rgba(0, 0, 0, 0.4);
  color: #e8e8e8;
  border: 1px solid rgba(232, 232, 232, 0.2);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(3px);
}

.menu-button:hover {
  background: rgba(0, 0, 0, 0.6);
  border-color: rgba(232, 232, 232, 0.4);
}

/* Buttons */
.btn {
  padding: 14px 28px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  margin: 5px;
}

.btn-large {
  padding: 18px 36px;
  font-size: 18px;
}

.btn-primary {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  border: 1px solid rgba(232, 232, 232, 0.2);
}

.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
  background: linear-gradient(135deg, #16213e 0%, #0f1626 100%);
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
  transform: translateY(-2px);
}

/* Responsive */
@media (max-width: 768px) {
  .hud-corner {
    padding: 8px;
  }

  .hud-text {
    font-size: 11px;
  }

  .hud-text-small {
    font-size: 9px;
  }

  .hud-stat-line {
    font-size: 10px;
  }

  .menu-button {
    padding: 6px 10px;
    font-size: 16px;
  }

  .start-content {
    padding: 40px 30px;
  }

  .start-content h1 {
    font-size: 36px;
  }

  .start-content p {
    font-size: 16px;
  }
}
</style>
