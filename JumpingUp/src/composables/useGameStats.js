import { ref, computed } from 'vue'

const STORAGE_KEY = 'jumping-up-game-save'

export function useGameStats() {
  const currentLevel = ref(1)
  const deaths = ref(0) // Pokusy = úmrtia
  const jumps = ref(0) // Skoky = počet skokov
  const totalDeaths = ref(0)
  const totalJumps = ref(0)
  const startTime = ref(null)
  const endTime = ref(null)
  const levelTimes = ref([])
  const completedLevels = ref([])
  const currentLevelStartTime = ref(null)
  const elapsedTime = ref(0)
  const timerInterval = ref(null)

  const totalTime = computed(() => {
    return levelTimes.value.reduce((sum, time) => sum + time, 0) + elapsedTime.value
  })

  const averageTime = computed(() => {
    if (completedLevels.value.length === 0) return 0
    const total = levelTimes.value.reduce((sum, time) => sum + time, 0)
    return Math.round(total / completedLevels.value.length)
  })

  const successRate = computed(() => {
    if (totalDeaths.value === 0) return 0
    return Math.round((completedLevels.value.length / totalDeaths.value) * 100)
  })

  function startLevel(levelId) {
    currentLevel.value = levelId
    deaths.value = 1
    jumps.value = 0
    elapsedTime.value = 0

    // Clear any existing timer
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // Start fresh timer
    currentLevelStartTime.value = Date.now()
    timerInterval.value = setInterval(() => {
      elapsedTime.value = Date.now() - currentLevelStartTime.value
    }, 100)

    saveToLocalStorage()
  }

  function recordDeath() {
    deaths.value++
    totalDeaths.value++
    jumps.value = 0  // Reset jumps on each death
    saveToLocalStorage()
  }

  function recordJump() {
    jumps.value++
    totalJumps.value++
    saveToLocalStorage()
  }

  function completeLevel() {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
    }

    const levelTime = Date.now() - currentLevelStartTime.value
    levelTimes.value.push(levelTime)

    completedLevels.value.push({
      levelId: currentLevel.value,
      deaths: deaths.value,
      jumps: jumps.value,
      time: levelTime,
      completedAt: new Date().toISOString()
    })

    saveToLocalStorage()

    return {
      levelId: currentLevel.value,
      deaths: deaths.value,
      jumps: jumps.value,
      time: levelTime
    }
  }

  function resetLevel() {
    deaths.value = 1
    jumps.value = 0
    elapsedTime.value = 0

    // Clear existing timer
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // Start fresh timer
    currentLevelStartTime.value = Date.now()
    timerInterval.value = setInterval(() => {
      elapsedTime.value = Date.now() - currentLevelStartTime.value
    }, 100)
  }

  function resumeLevel() {
    // Resume timer from saved elapsedTime without resetting stats
    // Clear any existing timer
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    // Start timer from saved elapsed time
    currentLevelStartTime.value = Date.now() - elapsedTime.value
    timerInterval.value = setInterval(() => {
      elapsedTime.value = Date.now() - currentLevelStartTime.value
    }, 100)
  }

  function resetStats() {
    currentLevel.value = 1
    deaths.value = 1
    jumps.value = 0
    totalDeaths.value = 0
    totalJumps.value = 0
    startTime.value = null
    endTime.value = null
    levelTimes.value = []
    completedLevels.value = []
    elapsedTime.value = 0
    currentLevelStartTime.value = null

    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    clearSavedGame()
  }

  function pauseTimer() {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
  }

  function resumeTimer() {
    if (currentLevelStartTime.value && !timerInterval.value) {
      // Recalculate start time to account for paused duration
      const pausedDuration = elapsedTime.value
      currentLevelStartTime.value = Date.now() - pausedDuration

      timerInterval.value = setInterval(() => {
        elapsedTime.value = Date.now() - currentLevelStartTime.value
      }, 100)
    }
  }

  function formatTime(ms) {
    // Handle invalid values
    if (ms === null || ms === undefined || isNaN(ms) || ms < 0) {
      return '0:00.00'
    }

    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    const remainingMs = Math.floor((ms % 1000) / 10)

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(2, '0')}`
  }

  function getStats() {
    return {
      currentLevel: currentLevel.value,
      deaths: deaths.value,
      jumps: jumps.value,
      totalDeaths: totalDeaths.value,
      totalJumps: totalJumps.value,
      completedLevels: completedLevels.value.length,
      totalTime: totalTime.value,
      averageTime: averageTime.value,
      successRate: successRate.value,
      elapsedTime: elapsedTime.value,
      levelHistory: completedLevels.value
    }
  }

  function saveToLocalStorage() {
    try {
      const saveData = {
        currentLevel: currentLevel.value,
        deaths: deaths.value,
        jumps: jumps.value,
        totalDeaths: totalDeaths.value,
        totalJumps: totalJumps.value,
        levelTimes: levelTimes.value,
        completedLevels: completedLevels.value,
        elapsedTime: elapsedTime.value,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
    } catch (error) {
      console.error('Failed to save game:', error)
    }
  }

  function loadFromLocalStorage() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY)
      if (savedData) {
        const data = JSON.parse(savedData)
        currentLevel.value = data.currentLevel || 1
        deaths.value = data.deaths || 0
        jumps.value = data.jumps || 0
        totalDeaths.value = data.totalDeaths || 0
        totalJumps.value = data.totalJumps || 0
        levelTimes.value = data.levelTimes || []
        completedLevels.value = data.completedLevels || []
        elapsedTime.value = data.elapsedTime || 0
      }
    } catch (error) {
      console.error('Failed to load game:', error)
    }
  }

  function hasSavedGame() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY)
      return savedData !== null
    } catch (error) {
      return false
    }
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear saved game:', error)
    }
  }

  // Load saved game on initialization
  loadFromLocalStorage()

  return {
    currentLevel,
    deaths,
    jumps,
    totalDeaths,
    totalJumps,
    elapsedTime,
    totalTime,
    averageTime,
    successRate,
    completedLevels,
    startLevel,
    recordDeath,
    recordJump,
    completeLevel,
    resetLevel,
    resumeLevel,
    resetStats,
    pauseTimer,
    resumeTimer,
    formatTime,
    getStats,
    saveToLocalStorage,
    hasSavedGame,
    clearSavedGame
  }
}
