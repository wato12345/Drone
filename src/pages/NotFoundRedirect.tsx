import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function NotFoundRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/', { replace: true })
  }, [navigate])

  return (
    <main className="page-main not-found-page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">404</p>
        <h1>Page Not Found</h1>
        <p className="page-lead">Returning to the previous page…</p>
      </section>
    </main>
  )
}
