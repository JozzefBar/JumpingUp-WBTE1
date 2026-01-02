<template>
  <div class="game-menu-overlay" @click="closeMenu">
    <div class="game-menu" @click.stop>
      <button class="close-button" @click="closeMenu">&times;</button>

      <h2>{{ title }}</h2>

      <div v-if="showInstructions" class="instructions">
        <h3>Ako hrať</h3>
        <ol class="instruction-steps">
          <li v-for="(step, index) in instructions.steps" :key="index">
            {{ step }}
          </li>
        </ol>

        <h3>Tipy</h3>
        <ul class="tips-list">
          <li v-for="(tip, index) in instructions.tips" :key="index">
            {{ tip }}
          </li>
        </ul>
      </div>

      <!-- Level Selector -->
      <div v-if="showLevelSelector" class="level-selector">
        <h3>Vyber level</h3>
        <div class="level-grid">
          <button
            v-for="level in totalLevels"
            :key="level"
            @click="selectLevel(level)"
            class="level-btn"
            :class="{
              'current': level === currentLevel,
              'completed': isLevelCompleted(level),
              'locked': isLevelLocked(level)
            }"
            :disabled="isLevelLocked(level)"
          >
            <div class="level-number">{{ level }}</div>
            <div v-if="isLevelCompleted(level)" class="level-check">✓</div>
            <div v-if="isLevelLocked(level)" class="level-lock">🔒</div>
          </button>
        </div>
      </div>

      <div v-if="showStats && stats" class="detailed-stats">
        <h3>Štatistiky</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">{{ stats.totalDeaths }}</div>
            <div class="stat-description">Celkový počet pokusov</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ stats.totalJumps }}</div>
            <div class="stat-description">Celkový počet skokov</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ stats.completedLevels }}</div>
            <div class="stat-description">Dokončené levely</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ formatTime(stats.totalTime) }}</div>
            <div class="stat-description">Celkový čas</div>
          </div>
        </div>

        <div v-if="stats.levelHistory && stats.levelHistory.length > 0" class="level-history">
          <h4>História levelov</h4>
          <div class="history-table">
            <div class="history-row header">
              <span>Level</span>
              <span>Názov</span>
              <span>Pokusy</span>
              <span>Skoky</span>
              <span>Čas</span>
            </div>
            <div
              v-for="level in stats.levelHistory"
              :key="level.completedAt"
              class="history-row"
            >
              <span>{{ level.levelId }}</span>
              <span>{{ level.name }}</span>
              <span>{{ level.deaths }}</span>
              <span>{{ level.jumps }}</span>
              <span>{{ formatTime(level.time) }} <span v-if="isBestTime(level)" style="color: #fbbf24;">🏆</span></span>
            </div>
          </div>
        </div>
      </div>

      <div class="menu-actions">
        <button v-if="showResume" @click="resumeGame" class="btn btn-primary">
          Pokračovať v hre
        </button>
        <button v-if="showStart" @click="handleStartGame" class="btn btn-primary">
          Začať hru
        </button>
        <button v-if="showRestart" @click="restartGame" class="btn btn-secondary">
          Reštartovať celú hru
        </button>
        <button @click="closeMenu" class="btn btn-secondary">Zavrieť</button>
      </div>
    </div>

    <!-- Start Confirmation Dialog -->
    <div v-if="showStartConfirmation" class="game-menu-overlay" @click="showStartConfirmation = false">
      <div class="game-menu start-confirmation-dialog" @click.stop>
        <h2>Uložená hra</h2>
        <p style="margin: 1.5rem 0; text-align: center; color: #f5deb3;">
          Máš uloženú rozohratú hru. Chceš pokračovať alebo začať odznova?
        </p>
        <div class="menu-actions">
          <button @click="continueGame" class="btn btn-primary">
            Pokračovať
          </button>
          <button @click="startGame" class="btn btn-secondary">
            Začať novú hru
          </button>
          <button @click="showStartConfirmation = false" class="btn btn-secondary">
            Zrušiť
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Jumping Up'
  },
  showInstructions: {
    type: Boolean,
    default: true
  },
  showStats: {
    type: Boolean,
    default: false
  },
  showResume: {
    type: Boolean,
    default: false
  },
  showStart: {
    type: Boolean,
    default: true
  },
  showRestart: {
    type: Boolean,
    default: false
  },
  showLevelSelector: {
    type: Boolean,
    default: false
  },
  totalLevels: {
    type: Number,
    default: 3
  },
  currentLevel: {
    type: Number,
    default: 1
  },
  instructions: {
    type: Object,
    required: true
  },
  stats: {
    type: Object,
    default: null
  },
  formatTime: {
    type: Function,
    required: true
  },
  hasSavedGame: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'start', 'resume', 'restart', 'select-level', 'continue-game'])

const showStartConfirmation = ref(false)

function closeMenu() {
  emit('close')
}

function handleStartGame() {
  // Check if there's a saved game
  if (props.hasSavedGame) {
    // Show confirmation dialog
    showStartConfirmation.value = true
  } else {
    // No saved game, just start new
    emit('start')
  }
}

function startGame() {
  showStartConfirmation.value = false
  emit('start')
}

function continueGame() {
  showStartConfirmation.value = false
  emit('continue-game')
}

function resumeGame() {
  emit('resume')
}

function restartGame() {
  emit('restart')
}

function selectLevel(level) {
  if (!isLevelLocked(level)) {
    emit('select-level', level)
  }
}

function isLevelCompleted(level) {
  if (!props.stats || !props.stats.levelHistory) return false
  return props.stats.levelHistory.some(l => l.levelId === level)
}

function isLevelLocked(level) {
  // Level 1 is always unlocked
  if (level === 1) return false

  // Check if previous level is completed
  const previousLevel = level - 1
  return !isLevelCompleted(previousLevel)
}

function isBestTime(level) {
  if (!props.stats || !props.stats.levelHistory) return false

  // Get all completions for this level
  const levelCompletions = props.stats.levelHistory.filter(l => l.levelId === level.levelId)

  if (levelCompletions.length === 0) return false

  // Find the minimum time for this level
  const minTime = Math.min(...levelCompletions.map(l => l.time))

  // Check if this level's time matches the minimum
  return level.time === minTime
}
</script>

<style src="../css/game-menu.css"></style>
