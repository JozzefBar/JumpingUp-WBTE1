<template>
  <div class="rotate-overlay" v-if="showRotatePrompt">
    <div class="rotate-content">
      <div class="phone-icon">📱</div>
      <div class="rotate-arrow">↻</div>
      <h2>Otoč zariadenie</h2>
      <p>Pre najlepší herný zážitok otočte zariadenie na šírku</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const showRotatePrompt = ref(false)

function checkOrientation() {
  // Show prompt only on small screens in portrait mode
  const isSmallScreen = window.innerWidth < 768
  const isPortrait = window.innerHeight > window.innerWidth
  showRotatePrompt.value = isSmallScreen && isPortrait
}

onMounted(() => {
  checkOrientation()
  window.addEventListener('resize', checkOrientation)
  window.addEventListener('orientationchange', checkOrientation)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkOrientation)
  window.removeEventListener('orientationchange', checkOrientation)
})
</script>

<style src="../css/rotate-device.css"></style>
