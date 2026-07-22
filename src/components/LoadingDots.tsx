import { useEffect, useState } from 'react'

interface LoadingDotsProps {
  label?: string
  className?: string
}

export function LoadingDots({ label = '解析中', className }: LoadingDotsProps) {
  const [dotCount, setDotCount] = useState(1)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDotCount((count) => (count >= 3 ? 1 : count + 1))
    }, 450)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <span className={className} aria-live="polite">
      {label}
      <span className="loading-dots-cycle" aria-hidden="true">
        {'.'.repeat(dotCount)}
      </span>
    </span>
  )
}
