import { verifyToken } from '../services/auth.js'
import { findUserById, toPublicUser } from '../db/index.js'

export const COOKIE_NAME = 'auth_token'

export function getTokenFromRequest(req) {
  const cookieToken = req.cookies?.[COOKIE_NAME]
  if (cookieToken) return cookieToken

  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return null
}

export async function authMiddleware(req, res, next) {
  const token = getTokenFromRequest(req)
  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  try {
    const payload = verifyToken(token)
    const user = await findUserById(payload.sub)
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }
    req.user = toPublicUser(user)
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}
