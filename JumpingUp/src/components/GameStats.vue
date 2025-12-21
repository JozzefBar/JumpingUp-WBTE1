<template>
  <div class="game-stats">
    <div class="stat-item">
      <span class="stat-label">Level:</span>
      <span class="stat-value">{{ currentLevel }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Pokusy:</span>
      <span class="stat-value">{{ deaths }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Skoky:</span>
      <span class="stat-value">{{ jumps }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Čas:</span>
      <span class="stat-value">{{ formattedTime }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentLevel: {
    type: Number,
    default: 1
  },
  deaths: {
    type: Number,
    default: 0
  },
  jumps: {
    type: Number,
    default: 0
  },
  elapsedTime: {
    type: Number,
    default: 0
  },
  formatTime: {
    type: Function,
    required: true
  }
})

const formattedTime = computed(() => {
  return props.formatTime(props.elapsedTime || 0)
})
</script>

<style src="../css/game-stats.css"></style>
