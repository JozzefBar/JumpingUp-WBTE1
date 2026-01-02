<template>
  <div class="level-complete-overlay">
    <div class="level-complete-card">
      <div class="celebration">🎉</div>
      <h2>Gratulujeme!</h2>
      <p class="level-name">{{ levelName }}</p>

      <div class="completion-stats">
        <div class="stat">
          <div class="stat-label">Pokusy</div>
          <div class="stat-value">{{ attempts }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Skoky</div>
          <div class="stat-value">{{ jumps }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Čas</div>
          <div class="stat-value">{{ formatTime(time) }}</div>
        </div>
      </div>

      <div class="actions">
        <button v-if="hasNextLevel" @click="nextLevel" class="btn btn-primary">
          Ďalší level
        </button>
        <button @click="restart" class="btn btn-secondary">Hrať znova</button>
        <button @click="menu" class="btn btn-secondary">Menu</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  levelName: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    required: true
  },
  jumps: {
    type: Number,
    required: true
  },
  time: {
    type: Number,
    required: true
  },
  hasNextLevel: {
    type: Boolean,
    default: true
  },
  formatTime: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['next-level', 'restart', 'menu'])

function nextLevel() {
  emit('next-level')
}

function restart() {
  emit('restart')
}

function menu() {
  emit('menu')
}
</script>

<style src="../css/level-complete.css"></style>
