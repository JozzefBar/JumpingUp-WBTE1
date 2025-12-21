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

<style scoped>
.rotate-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.rotate-content {
  text-align: center;
  color: #e8e8e8;
  padding: 40px;
}

.phone-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: shake 1s infinite;
}

.rotate-arrow {
  font-size: 60px;
  color: #4ade80;
  margin-bottom: 20px;
  animation: rotate 2s linear infinite;
}

@keyframes shake {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-15deg);
  }
  75% {
    transform: rotate(15deg);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

h2 {
  font-size: 32px;
  margin: 20px 0;
  color: #e8e8e8;
}

p {
  font-size: 18px;
  color: #b8b8c8;
  max-width: 300px;
  margin: 0 auto;
}
</style>
