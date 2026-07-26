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
        return res.status(409).json({ error: '用户名已被占用' })
      }
      if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
        return res.status(409).json({ error: '邮箱已被注册' })
      }
      console.error('Register error:', err)
      res.status(500).json({ error: '注册失败，请稍后重试' })
    }
  })

  router.post('/login', async (req, res) => {
    try {
      const username = req.body?.username?.trim()
      const password = req.body?.password

      if (!username || !password) {
        return res.status(400).json({ error: '请输入用户名和密码' })
      }

      const user = await findUserByUsername(username)
      if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' })
      }

      const valid = await verifyPassword(password, user.password_hash)
      if (!valid) {
        return res.status(401).json({ error: '用户名或密码错误' })
      }

      const token = signToken(user)
      setAuthCookie(res, token)
      res.json({ user: toPublicUser(user) })
    } catch (err) {
      console.error('Login error:', err)
      res.status(500).json({ error: '登录失败，请稍后重试' })
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
