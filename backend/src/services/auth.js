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
  if (typeof username !== 'string') return 'Invalid username'
  const trimmed = username.trim()
  if (trimmed.length < 3 || trimmed.length > 32) return 'Username must be 3–32 characters'
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Username may only contain letters, numbers, and underscores'
  return null
}

export function validatePassword(password) {
  if (typeof password !== 'string') return 'Invalid password'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 128) return 'Password is too long'
  return null
}

export function validateEmail(email) {
  if (!email) return null
  if (typeof email !== 'string') return 'Invalid email'
  const trimmed = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Invalid email format'
  return null
}
