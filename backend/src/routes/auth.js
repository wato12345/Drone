import { Router } from 'express'
import {
  hashPassword,
  signToken,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '../services/auth.js'
import { createUser, findUserByUsername, toPublicUser } from '../db/index.js'
import { authMiddleware, COOKIE_NAME } from '../middleware/auth.js'
import {
  requestPasswordResetCode,
  resetPasswordWithCode,
} from '../services/passwordReset.js'

export function createAuthRouter({ isProd }) {
  const router = Router()

  function cookieOptions() {
    return {
      httpOnly: true,
      secure: isProd,
      // Cross-site (GitHub Pages → Railway) requires SameSite=None + Secure
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    }
  }

  function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, cookieOptions())
  }

  router.post('/register', async (req, res) => {
    try {
      const username = req.body?.username?.trim()
      const password = req.body?.password
      const email = req.body?.email?.trim() || null

      const usernameError = validateUsername(username)
      if (usernameError) return res.status(400).json({ error: usernameError })

      const passwordError = validatePassword(password)
      if (passwordError) return res.status(400).json({ error: passwordError })

      const emailError = validateEmail(email)
      if (emailError) return res.status(400).json({ error: emailError })

      const passwordHash = await hashPassword(password)
      const user = await createUser({ username, email, passwordHash })
      const token = signToken(user)
      setAuthCookie(res, token)

      res.status(201).json({ user: toPublicUser(user) })
    } catch (err) {
      if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
        return res.status(409).json({ error: 'Username already taken' })
      }
      if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
        return res.status(409).json({ error: 'Email already registered' })
      }
      console.error('Register error:', err)
      res.status(500).json({ error: 'Registration failed; please try again later' })
    }
  })

  router.post('/login', async (req, res) => {
    try {
      const username = req.body?.username?.trim()
      const password = req.body?.password

      if (!username || !password) {
        return res.status(400).json({ error: 'Please enter username and password' })
      }

      const user = await findUserByUsername(username)
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const valid = await verifyPassword(password, user.password_hash)
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const token = signToken(user)
      setAuthCookie(res, token)
      res.json({ user: toPublicUser(user) })
    } catch (err) {
      console.error('Login error:', err)
      res.status(500).json({ error: 'Login failed; please try again later' })
    }
  })

  router.post('/forgot-password', async (req, res) => {
    try {
      const result = await requestPasswordResetCode({
        email: req.body?.email,
        clientKey: req.ip || req.socket?.remoteAddress || 'unknown',
      })
      res.json(result)
    } catch (err) {
      const status = Number(err?.status) || 500
      const message =
        err instanceof Error && status < 500
          ? err.message
          : 'Failed to send verification code; please try again later'
      if (status >= 500) console.error('Forgot password error:', err)
      res.status(status).json({ error: message })
    }
  })

  router.post('/reset-password', async (req, res) => {
    try {
      const result = await resetPasswordWithCode({
        email: req.body?.email,
        code: req.body?.code,
        password: req.body?.password,
      })
      res.clearCookie(COOKIE_NAME, cookieOptions())
      res.json(result)
    } catch (err) {
      const status = Number(err?.status) || 500
      const message =
        err instanceof Error && status < 500
          ? err.message
          : 'Failed to reset password; please try again later'
      if (status >= 500) console.error('Reset password error:', err)
      res.status(status).json({ error: message })
    }
  })

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions())
    res.json({ ok: true })
  })

  router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user })
  })

  return router
}
