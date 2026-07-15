import { useEffect, useRef } from 'react'
import type { WeatherCondition } from '../utils/weatherCodes'

interface WeatherOverlayProps {
  condition: WeatherCondition
  isDay: boolean
  visible: boolean
}

interface Particle {
  x: number
  y: number
  speed: number
  length: number
  opacity: number
  drift: number
}

function createRainParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    speed: 8 + Math.random() * 12,
    length: 12 + Math.random() * 18,
    opacity: 0.25 + Math.random() * 0.45,
    drift: -1.5 + Math.random() * 1,
  }))
}

function createSnowParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    speed: 0.8 + Math.random() * 2.2,
    length: 2 + Math.random() * 3,
    opacity: 0.4 + Math.random() * 0.5,
    drift: -0.8 + Math.random() * 1.6,
  }))
}

export function WeatherOverlay({ condition, isDay, visible }: WeatherOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !visible) return

    const needsCanvas = condition === 'rain' || condition === 'snow' || condition === 'thunder'
    if (!needsCanvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
      const count = condition === 'snow' ? 120 : 180
      particlesRef.current =
        condition === 'snow'
          ? createSnowParticles(count, canvas.width, canvas.height)
          : createRainParticles(count, canvas.width, canvas.height)
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particlesRef.current) {
        if (condition === 'snow') {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.length, 0, Math.PI * 2)
          ctx.fill()
          p.y += p.speed
          p.x += p.drift
        } else {
          ctx.strokeStyle =
            condition === 'thunder'
              ? `rgba(186, 210, 255, ${p.opacity})`
              : `rgba(174, 198, 255, ${p.opacity})`
          ctx.lineWidth = condition === 'thunder' ? 2 : 1.2
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + p.drift * 2, p.y + p.length)
          ctx.stroke()
          p.y += p.speed
          p.x += p.drift
        }

        if (p.y > canvas.height + 20) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
        if (p.x < -20) p.x = canvas.width + 20
        if (p.x > canvas.width + 20) p.x = -20
      }

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frameRef.current)
    }
  }, [condition, visible])

  if (!visible) return null

  const showCanvas = condition === 'rain' || condition === 'snow' || condition === 'thunder'
  const showClouds =
    condition === 'cloudy' ||
    condition === 'partly-cloudy' ||
    condition === 'rain' ||
    condition === 'snow' ||
    condition === 'thunder'
  const showEdgeMist =
    condition === 'cloudy' ||
    condition === 'partly-cloudy' ||
    condition === 'fog' ||
    condition === 'rain' ||
    condition === 'snow' ||
    condition === 'thunder'
  const edgeMistIntensity =
    condition === 'cloudy' || condition === 'fog'
      ? 'heavy'
      : condition === 'partly-cloudy'
        ? 'light'
        : 'medium'
  const showSun = (condition === 'sunny' || condition === 'partly-cloudy') && isDay
  const showFog = condition === 'fog'
  const showThunderFlash = condition === 'thunder'

  return (
    <div
      className={`weather-overlay weather-${condition}${isDay ? '' : ' night'}`}
      aria-hidden
    >
      {showSun && <div className="weather-sun-glow" />}
      {showEdgeMist && (
        <div className={`weather-edge-mist mist-${edgeMistIntensity}`}>
          <div className="weather-edge-mist-base" />
          <div className="weather-edge-mist-wisp weather-edge-mist-wisp-1" />
          <div className="weather-edge-mist-wisp weather-edge-mist-wisp-2" />
          <div className="weather-edge-mist-wisp weather-edge-mist-wisp-3" />
          <div className="weather-edge-mist-wisp weather-edge-mist-wisp-4" />
        </div>
      )}
      {showClouds && (
        <>
          <div className="weather-cloud weather-cloud-1" />
          <div className="weather-cloud weather-cloud-2" />
          <div className="weather-cloud weather-cloud-3" />
        </>
      )}
      {showFog && <div className="weather-fog" />}
      {showThunderFlash && <div className="weather-lightning" />}
      {showCanvas && <canvas ref={canvasRef} className="weather-canvas" />}
      <div className="weather-tint" />
    </div>
  )
}
