import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const SALT_ROUNDS = 12
const JWT_EXPIRES_IN = '7d'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters')
  }
  return secret
}

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash)
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN },
  )
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret())
}

export function validateUsername(username) {
  if (typeof username !== 'string') return '用户名无效'
  const trimmed = username.trim()
  if (trimmed.length < 3 || trimmed.length > 32) return '用户名长度需为 3–32 个字符'
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return '用户名只能包含字母、数字和下划线'
  return null
}

export function validatePassword(password) {
  if (typeof password !== 'string') return '密码无效'
  if (password.length < 8) return '密码至少 8 个字符'
  if (password.length > 128) return '密码过长'
  return null
}

export function validateEmail(email) {
  if (!email) return null
  if (typeof email !== 'string') return '邮箱无效'
  const trimmed = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return '邮箱格式不正确'
  return null
}
