interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  seed: number
  kind: 'flame' | 'spark'
}

export interface CanvasFireOptions {
  compact?: boolean
}

export interface CanvasFireController {
  resize: (width: number, height: number) => void
  start: () => void
  stop: () => void
  destroy: () => void
}

function spawnParticle(width: number, height: number, compact: boolean, kind: 'flame' | 'spark' = 'flame'): Particle {
  const spread = width * (compact ? 0.72 : 0.82)
  const center = width * 0.5
  const x = center + (Math.random() - 0.5) * spread

  if (kind === 'spark') {
    return {
      x,
      y: height - 2 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 2.4,
      vy: -(Math.random() * 2.2 + 2.8),
      life: 0,
      maxLife: 10 + Math.random() * 14,
      size: 1.5 + Math.random() * 2.5,
      seed: Math.random() * Math.PI * 2,
      kind: 'spark',
    }
  }

  return {
    x,
    y: height - 1 + Math.random() * 3,
    vx: (Math.random() - 0.5) * (compact ? 1.1 : 1.6),
    vy: -(Math.random() * 2.6 + 2.2) * (compact ? 1 : 1.35),
    life: 0,
    maxLife: (compact ? 38 : 50) + Math.random() * (compact ? 42 : 58),
    size: (compact ? 6 : 9) + Math.random() * (compact ? 14 : 22),
    seed: Math.random() * Math.PI * 2,
    kind: 'flame',
  }
}

function drawSpark(ctx: CanvasRenderingContext2D, particle: Particle) {
  const t = particle.life / particle.maxLife
  const alpha = (1 - t) ** 2.2
  const radius = particle.size * (1.1 - t * 0.5)

  const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius * 2.2)
  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
  gradient.addColorStop(0.25, `rgba(255, 248, 200, ${alpha * 0.85})`)
  gradient.addColorStop(0.55, `rgba(253, 224, 71, ${alpha * 0.35})`)
  gradient.addColorStop(1, 'rgba(249, 115, 22, 0)')

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(particle.x, particle.y, radius * 2.2, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(particle.x, particle.y - radius * 2)
  ctx.lineTo(particle.x, particle.y + radius * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(particle.x - radius * 2, particle.y)
  ctx.lineTo(particle.x + radius * 2, particle.y)
  ctx.stroke()
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  const t = particle.life / particle.maxLife
  const alpha = (1 - t) ** 1.6 * 0.52
  const radius = particle.size * (0.55 + (1 - t) * 0.72)

  const gradient = ctx.createRadialGradient(
    particle.x,
    particle.y,
    0,
    particle.x,
    particle.y - radius * 0.15,
    radius,
  )

  if (t < 0.22) {
    gradient.addColorStop(0, `rgba(255, 255, 245, ${alpha})`)
    gradient.addColorStop(0.18, `rgba(255, 244, 160, ${alpha * 0.95})`)
    gradient.addColorStop(0.45, `rgba(255, 170, 40, ${alpha * 0.65})`)
    gradient.addColorStop(1, 'rgba(120, 20, 0, 0)')
  } else if (t < 0.55) {
    gradient.addColorStop(0, `rgba(255, 210, 80, ${alpha * 0.9})`)
    gradient.addColorStop(0.35, `rgba(255, 100, 10, ${alpha * 0.55})`)
    gradient.addColorStop(1, 'rgba(80, 8, 0, 0)')
  } else {
    gradient.addColorStop(0, `rgba(255, 90, 10, ${alpha * 0.45})`)
    gradient.addColorStop(0.5, `rgba(180, 25, 0, ${alpha * 0.22})`)
    gradient.addColorStop(1, 'rgba(40, 0, 0, 0)')
  }

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.ellipse(particle.x, particle.y, radius * 0.82, radius, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawBaseGlow(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const pulse = 0.92 + Math.sin(time * 0.07) * 0.08
  const glowHeight = height * 0.52 * pulse

  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height,
    0,
    width * 0.5,
    height - glowHeight * 0.4,
    width * 0.58,
  )
  gradient.addColorStop(0, 'rgba(255, 210, 80, 0.32)')
  gradient.addColorStop(0.35, 'rgba(255, 110, 20, 0.18)')
  gradient.addColorStop(0.7, 'rgba(180, 30, 0, 0.07)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, height - glowHeight, width, glowHeight)
}

function updateParticle(particle: Particle, width: number, time: number, compact: boolean) {
  particle.life += 1
  const t = particle.life / particle.maxLife

  if (particle.kind === 'spark') {
    particle.x += particle.vx
    particle.y += particle.vy
    particle.vy -= 0.06
    return particle.life < particle.maxLife && particle.y > -particle.size * 4
  }

  const wobble = Math.sin(time * 0.011 + particle.seed) * (compact ? 0.55 : 0.85)
  const wobble2 = Math.cos(time * 0.017 + particle.seed * 1.7) * 0.35

  particle.x += particle.vx + wobble + wobble2
  particle.y += particle.vy
  particle.vy -= compact ? 0.024 : 0.032
  particle.vx *= 0.985

  const edgePull = (particle.x - width * 0.5) / (width * 0.5)
  particle.vx -= edgePull * 0.04

  return particle.life < particle.maxLife && particle.y > -particle.size && t < 1
}

export function createCanvasFire(
  canvas: HTMLCanvasElement,
  options: CanvasFireOptions = {},
): CanvasFireController {
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) {
    return {
      resize: () => {},
      start: () => {},
      stop: () => {},
      destroy: () => {},
    }
  }

  const context = ctx

  const compact = options.compact ?? false
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const maxParticles = reducedMotion ? 12 : compact ? 28 : 40
  const spawnPerFrame = reducedMotion ? 1 : compact ? 1 : 2

  let particles: Particle[] = []
  let width = 0
  let height = 0
  let dpr = 1
  let time = 0
  let running = false
  let raf = 0

  function resize(nextWidth: number, nextHeight: number) {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = nextWidth
    height = nextHeight
    canvas.width = Math.max(1, Math.floor(nextWidth * dpr))
    canvas.height = Math.max(1, Math.floor(nextHeight * dpr))
    canvas.style.width = `${nextWidth}px`
    canvas.style.height = `${nextHeight}px`
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function tick() {
    if (!running || width <= 0 || height <= 0) return

    time += 1

    context.globalCompositeOperation = 'source-over'
    context.fillStyle = 'rgba(6, 3, 2, 0.14)'
    context.fillRect(0, 0, width, height)

    context.globalCompositeOperation = 'lighter'
    drawBaseGlow(context, width, height, time)

    for (let i = 0; i < spawnPerFrame; i += 1) {
      if (particles.length < maxParticles) {
        particles.push(spawnParticle(width, height, compact))
      }
    }

    if (Math.random() < (compact ? 0.22 : 0.32)) {
      particles.push(spawnParticle(width, height, compact, 'spark'))
    }

    particles = particles.filter((particle) => {
      const alive = updateParticle(particle, width, time, compact)
      if (alive) {
        if (particle.kind === 'spark') drawSpark(context, particle)
        else drawParticle(context, particle)
      }
      return alive
    })

    raf = requestAnimationFrame(tick)
  }

  function start() {
    if (running) return
    running = true
    tick()
  }

  function stop() {
    running = false
    cancelAnimationFrame(raf)
  }

  function handleVisibility() {
    if (document.hidden) {
      stop()
    } else {
      start()
    }
  }

  document.addEventListener('visibilitychange', handleVisibility)

  function destroy() {
    document.removeEventListener('visibilitychange', handleVisibility)
    stop()
    particles = []
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  return { resize, start, stop, destroy }
}
