import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

type AuthMode = 'login' | 'register'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register, isLoading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setConfirmPassword('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register(username.trim(), password, email.trim() || undefined)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-card auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="关闭">
          ×
        </button>

        <div className="auth-brand">
          <div className="auth-icon">UAV</div>
          <div>
            <h1>账号登录</h1>
            <p>{mode === 'login' ? '登录您的账号' : '创建新账号'}</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => switchMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => switchMode('register')}
          >
            注册
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>用户名</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3–32 位字母、数字或下划线"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_]+"
            />
          </label>

          {mode === 'register' && (
            <label className="auth-field">
              <span>邮箱（可选）</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>
          )}

          <label className="auth-field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 个字符"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </label>

          {mode === 'register' && (
            <label className="auth-field">
              <span>确认密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting || isLoading}>
            {submitting ? '处理中…' : mode === 'login' ? '登录' : '创建账号'}
          </button>
        </form>
      </div>
    </div>
  )
}
