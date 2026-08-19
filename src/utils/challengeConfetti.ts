import confetti from 'canvas-confetti'

export function burstChallengeConfetti() {
  const shoot = (originX: number) => {
    void confetti({
      particleCount: 70,
      spread: 72,
      startVelocity: 38,
      origin: { x: originX, y: 0.28 },
      colors: ['#f472b6', '#a78bfa', '#fbbf24', '#ffffff', '#fb7185'],
    })
  }

  shoot(0.28)
  window.setTimeout(() => shoot(0.72), 90)
  window.setTimeout(() => {
    void confetti({
      particleCount: 40,
      spread: 100,
      startVelocity: 24,
      origin: { x: 0.5, y: 0.42 },
      colors: ['#f472b6', '#c4b5fd', '#fde68a'],
    })
  }, 180)
}
