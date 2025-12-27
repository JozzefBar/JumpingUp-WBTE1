import { ref } from 'vue'

export function useGamePhysics(settings) {
  const playerPosition = ref({ x: 0, y: 0 })
  const velocity = ref({ x: 0, y: 0 })
  const isJumping = ref(false)
  const isOnPlatform = ref(false)

  const gravity = settings.gravity || 0.5
  const friction = 0.95

  function checkPlatformCollision(platforms) {
    const playerBottom = playerPosition.value.y + settings.playerHeight
    const playerLeft = playerPosition.value.x
    const playerRight = playerPosition.value.x + settings.playerWidth
    const playerTop = playerPosition.value.y
    const playerCenterX = playerPosition.value.x + settings.playerWidth / 2

    let onPlatform = false

    for (const platform of platforms) {
      const platformBottom = platform.y + platform.height
      const platformLeft = platform.x
      const platformRight = platform.x + platform.width
      const platformTop = platform.y

      // Check if player's center is over the platform (more realistic landing)
      const horizontalOverlap = playerCenterX > platformLeft && playerCenterX < platformRight
      // Check if player overlaps vertically with platform
      const verticalOverlap = playerBottom > platformTop && playerTop < platformBottom

      // Enhanced collision detection for landing from above
      if (horizontalOverlap && velocity.value.y >= 0) {
        // Check if player crossed through platform this frame
        const previousBottom = playerBottom - velocity.value.y

        // If player was above platform and is now below or on it
        if (previousBottom <= platformTop && playerBottom >= platformTop) {
          // Land on platform
          playerPosition.value.y = platformTop - settings.playerHeight
          velocity.value.y = 0
          velocity.value.x *= friction
          isJumping.value = false
          onPlatform = true
          break
        }
      }

      // Enhanced collision detection for hitting from below
      if (horizontalOverlap && velocity.value.y < 0) {
        // Check if player crossed through platform bottom this frame
        const previousTop = playerTop - velocity.value.y

        // If player was below platform and is now above or at it
        if (previousTop >= platformBottom && playerTop <= platformBottom) {
          // Hit head on platform bottom
          playerPosition.value.y = platformBottom
          velocity.value.y = 0
        }
      }

      // Side collision detection (left and right)
      if (verticalOverlap && velocity.value.x !== 0) {
        // Check collision from left (player moving right)
        if (velocity.value.x > 0) {
          const previousRight = playerRight - velocity.value.x
          if (previousRight <= platformLeft && playerRight >= platformLeft) {
            // Hit platform from left side
            playerPosition.value.x = platformLeft - settings.playerWidth
            velocity.value.x = -velocity.value.x * 0.3 // Bounce back with reduced velocity
          }
        }
        // Check collision from right (player moving left)
        else if (velocity.value.x < 0) {
          const previousLeft = playerLeft - velocity.value.x
          if (previousLeft >= platformRight && playerLeft <= platformRight) {
            // Hit platform from right side
            playerPosition.value.x = platformRight
            velocity.value.x = -velocity.value.x * 0.3 // Bounce back with reduced velocity
          }
        }
      }
    }

    isOnPlatform.value = onPlatform
    return onPlatform
  }

  function checkGoalCollision(goal) {
    const playerBottom = playerPosition.value.y + settings.playerHeight
    const playerLeft = playerPosition.value.x
    const playerRight = playerPosition.value.x + settings.playerWidth
    const playerTop = playerPosition.value.y

    return (
      playerRight > goal.x &&
      playerLeft < goal.x + goal.width &&
      playerBottom > goal.y &&
      playerTop < goal.y + goal.height
    )
  }

  function updatePhysics(platforms, canvasHeight) {
    if (isJumping.value) {
      // Apply gravity
      velocity.value.y += gravity

      // Apply velocity to position
      playerPosition.value.x += velocity.value.x
      playerPosition.value.y += velocity.value.y

      // Check platform collision
      checkPlatformCollision(platforms)

      // Check if player fell off screen
      if (playerPosition.value.y > canvasHeight) {
        return 'fell'
      }

      // Keep player within horizontal bounds
      if (playerPosition.value.x < 0) {
        playerPosition.value.x = 0
        velocity.value.x = 0
      }
      if (playerPosition.value.x + settings.playerWidth > settings.canvasWidth) {
        playerPosition.value.x = settings.canvasWidth - settings.playerWidth
        velocity.value.x = 0
      }
    }

    return 'playing'
  }

  function jump(dragDistance, dragAngle) {
    // Calculate jump power based on drag distance
    const power = Math.min(dragDistance * settings.dragMultiplier, settings.maxJumpPower)

    // Calculate velocity components
    velocity.value.x = Math.cos(dragAngle) * power
    velocity.value.y = Math.sin(dragAngle) * power

    isJumping.value = true
    isOnPlatform.value = false
  }

  function setPosition(x, y) {
    playerPosition.value.x = x
    playerPosition.value.y = y
    velocity.value.x = 0
    velocity.value.y = 0
    isJumping.value = false
    isOnPlatform.value = true
  }

  function reset() {
    velocity.value.x = 0
    velocity.value.y = 0
    isJumping.value = false
    isOnPlatform.value = true
  }

  function startFalling() {
    isJumping.value = true
    isOnPlatform.value = false
  }

  return {
    playerPosition,
    velocity,
    isJumping,
    isOnPlatform,
    updatePhysics,
    checkGoalCollision,
    jump,
    setPosition,
    reset,
    startFalling
  }
}
