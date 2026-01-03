import { ref, computed } from 'vue'

const STORAGE_KEY = 'jumping-up-game-save'

export function useGameStats() {
  const currentLevel = ref(1)
  const deaths = ref(1) // Attempts = deaths starts at 1 (first attempt)
  const jumps = ref(0) // Jumps 
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

    // Add current attempt to totals (totals include current attempt)
    totalDeaths.value++

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
    totalDeaths.value++  // Update total immediately
    // Don't reset jumps - they accumulate across attempts in the same level
    saveToLocalStorage()
  }

  function recordJump() {
    jumps.value++
    totalJumps.value++  // Update total immediately
    saveToLocalStorage()
  }

  function completeLevel(levelName = '', collectedCourageOrb = false) {
    const levelTime = Date.now() - currentLevelStartTime.value

    // Update elapsedTime to exact completion time before stopping timer
    elapsedTime.value = levelTime

    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }

    levelTimes.value.push(levelTime)

    // Don't add to totals - the successful attempt is already counted
    // (was added by startLevel or recordDeath)

    completedLevels.value.push({
      levelId: currentLevel.value,
      name: levelName,
      deaths: deaths.value,
      jumps: jumps.value,
      time: levelTime,
      completedAt: new Date().toISOString(),
      collectedCourageOrb: collectedCourageOrb
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
    // Subtract current level stats from totals before resetting
    totalDeaths.value -= deaths.value // Subtract all attempts including current
    totalJumps.value -= jumps.value

    // Ensure totals don't go negative
    if (totalDeaths.value < 0) totalDeaths.value = 0
    if (totalJumps.value < 0) totalJumps.value = 0

    // Reset current level stats
    deaths.value = 1
    jumps.value = 0
    elapsedTime.value = 0

    // Add back the first attempt (totals include current attempt)
    totalDeaths.value++

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

    saveToLocalStorage()
  }

  function resumeLevel() {
    // When resuming from saved game, reset the level stats but keep totals
    // Subtract current saved stats from totals
    totalDeaths.value -= deaths.value // Subtract all attempts including current
    totalJumps.value -= jumps.value

    // Ensure totals don't go negative
    if (totalDeaths.value < 0) totalDeaths.value = 0
    if (totalJumps.value < 0) totalJumps.value = 0

    // Reset current level stats
    deaths.value = 1
    jumps.value = 0
    elapsedTime.value = 0

    // Add back the first attempt (totals include current attempt)
    totalDeaths.value++

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

  function continueCurrentLevel() {
    // Replay the same level after completion
    // Reset current level stats but keep totals accumulating

    // Reset current level stats
    deaths.value = 1
    jumps.value = 0
    elapsedTime.value = 0

    // Add the first attempt to totals (totals include current attempt)
    totalDeaths.value++

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

    saveToLocalStorage()
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
    // Count unique completed levels (not total completions)
    const uniqueLevels = new Set(completedLevels.value.map(l => l.levelId))

    return {
      currentLevel: currentLevel.value,
      deaths: deaths.value,
      jumps: jumps.value,
      totalDeaths: totalDeaths.value,
      totalJumps: totalJumps.value,
      completedLevels: uniqueLevels.size,
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
        deaths.value = data.deaths >= 1 ? data.deaths : 1 // Ensure minimum of 1 (first attempt)
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
    continueCurrentLevel,
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
