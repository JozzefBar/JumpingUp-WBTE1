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
              <span>Pokusy</span>
              <span>Skoky</span>
              <span>Čas</span>
            </div>
            <div
              v-for="level in stats.levelHistory"
              :key="level.completedAt"
              class="history-row"
            >
              <span>Level {{ level.levelId }}</span>
              <span>{{ level.deaths }}</span>
              <span>{{ level.jumps }}</span>
              <span>{{ formatTime(level.time) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="menu-actions">
        <button v-if="showResume" @click="resumeGame" class="btn btn-primary">
          Pokračovať v hre
        </button>
        <button v-if="showStart" @click="startGame" class="btn btn-primary">
          Začať hru
        </button>
        <button v-if="showRestart" @click="restartGame" class="btn btn-secondary">
          Reštartovať
        </button>
        <button @click="closeMenu" class="btn btn-secondary">Zavrieť</button>
      </div>
    </div>
  </div>
</template>

<script setup>
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
  }
})

const emit = defineEmits(['close', 'start', 'resume', 'restart'])

function closeMenu() {
  emit('close')
}

function startGame() {
  emit('start')
}

function resumeGame() {
  emit('resume')
}

function restartGame() {
  emit('restart')
}
</script>

<style src="../css/game-menu.css"></style>
