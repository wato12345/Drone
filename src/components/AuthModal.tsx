import { useEffect, useState, type FormEvent } from 'react'
import { requestPasswordReset, resetPassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

const RESEND_COOLDOWN_SEC = 60

function setEnglishValidity(input: HTMLInputElement, message: string) {
  input.setCustomValidity(input.validity.valid ? '' : message)
}

function handleEnglishInvalid(event: FormEvent<HTMLInputElement>, message: string) {
  event.currentTarget.setCustomValidity(message)
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register, isLoading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!open) return
    setMode('login')
    setUsername('')
    setEmail('')
    setCode('')
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setInfo(null)
    setCooldown(0)
    setSubmitting(false)
  }, [open])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  if (!open) return null

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setInfo(null)
    setPassword('')
    setConfirmPassword('')
    if (next !== 'reset') setCode('')
  }

  const sendCode = async () => {
    const result = await requestPasswordReset(email.trim())
    setInfo(result.message)
    setCooldown(RESEND_COOLDOWN_SEC)
    setMode('reset')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setInfo(null)

    if ((mode === 'register' || mode === 'reset') && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
        onClose()
      } else if (mode === 'register') {
        await register(username.trim(), password, email.trim() || undefined)
        onClose()
      } else if (mode === 'forgot') {
        await sendCode()
      } else {
        const result = await resetPassword({
          email: email.trim(),
          code: code.trim(),
          password,
        })
        setInfo(result.message)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setCode('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || submitting || !email.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await sendCode()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    mode === 'login'
      ? 'Sign in to your account'
      : mode === 'register'
        ? 'Create a new account'
        : mode === 'forgot'
          ? 'We will email you a 6-digit code'
          : 'Enter the code from your inbox'

  const submitLabel =
    mode === 'login'
      ? 'Sign in'
      : mode === 'register'
        ? 'Create account'
        : mode === 'forgot'
          ? 'Send verification code'
          : 'Update password'

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-card auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="auth-brand">
          <div className="auth-icon">UAV</div>
          <div>
            <h1>{mode === 'forgot' || mode === 'reset' ? 'Reset password' : 'Account'}</h1>
            <p>{title}</p>
          </div>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => switchMode('register')}
            >
              Register
            </button>
          </div>
        )}

        {(mode === 'forgot' || mode === 'reset') && (
          <ol className="auth-steps" aria-label="Password reset steps">
            <li className={mode === 'forgot' ? 'active' : 'done'}>
              <span>1</span>
              Email
            </li>
            <li className={mode === 'reset' ? 'active' : ''}>
              <span>2</span>
              Code &amp; password
            </li>
          </ol>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {(mode === 'login' || mode === 'register') && (
            <label className="auth-field">
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3–32 letters, numbers, or underscores"
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_]+"
              />
            </label>
          )}

          {(mode === 'register' || mode === 'forgot' || mode === 'reset') && (
            <label className="auth-field">
              <span>
                {mode === 'register' ? 'Email (recommended for password recovery)' : 'Account email'}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEnglishValidity(e.currentTarget, 'Please enter a valid email address')
                }}
                onInvalid={(e) =>
                  handleEnglishInvalid(
                    e,
                    e.currentTarget.value.trim()
                      ? 'Please enter a valid email address'
                      : 'Please enter your email address',
                  )
                }
                placeholder="name@example.com"
                autoComplete="email"
                required={mode !== 'register'}
                readOnly={mode === 'reset'}
                className={mode === 'reset' ? 'is-readonly' : undefined}
              />
              {mode === 'forgot' && (
                <small className="auth-hint">
                  Must match the email on your account. Unregistered emails will not receive a code.
                </small>
              )}
              {mode === 'reset' && (
                <small className="auth-hint">Code sent to this address. Check spam if needed.</small>
              )}
            </label>
          )}

          {mode === 'reset' && (
            <label className="auth-field">
              <span>Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                autoComplete="one-time-code"
                className="auth-code-input"
                required
              />
              <small className="auth-hint">6 digits · expires in 15 minutes</small>
            </label>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <label className="auth-field">
              <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
              />
            </label>
          )}

          {(mode === 'register' || mode === 'reset') && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting || isLoading}>
            {submitting ? 'Processing…' : submitLabel}
          </button>
        </form>

        <div className="auth-footer-links">
          {mode === 'login' && (
            <button type="button" className="auth-text-link" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
          )}
          {(mode === 'forgot' || mode === 'reset') && (
            <button type="button" className="auth-text-link" onClick={() => switchMode('login')}>
              Back to sign in
            </button>
          )}
          {mode === 'reset' && (
            <button
              type="button"
              className="auth-text-link"
              onClick={() => void handleResend()}
              disabled={cooldown > 0 || submitting}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
