import { randomInt, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  createPasswordResetCode,
  findActivePasswordResetCode,
  findUserByEmail,
  incrementPasswordResetAttempts,
  invalidatePasswordResetCodes,
  markPasswordResetCodeUsed,
  updateUserPassword,
} from '../db/index.js'
import { hashPassword, validateEmail, validatePassword } from './auth.js'
import { sendPasswordResetCodeEmail } from './resend.js'

const CODE_TTL_MS = 15 * 60 * 1000
const CODE_LENGTH = 6
const MAX_VERIFY_ATTEMPTS = 5
const FORGOT_LIMIT = 3
const FORGOT_WINDOW_MS = 15 * 60 * 1000

/** @type {Map<string, { count: number, resetAt: number }>} */
const forgotRateLimit = new Map()

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

export function validateEmailRequired(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return 'Email is required'
  return validateEmail(normalized)
}

function checkForgotRateLimit(key) {
  const now = Date.now()
  const entry = forgotRateLimit.get(key)
  if (!entry || entry.resetAt <= now) {
    forgotRateLimit.set(key, { count: 1, resetAt: now + FORGOT_WINDOW_MS })
    return null
  }
  if (entry.count >= FORGOT_LIMIT) {
    return 'Too many reset requests. Please try again later.'
  }
  entry.count += 1
  return null
}

function generateCode() {
  const max = 10 ** CODE_LENGTH
  return String(randomInt(0, max)).padStart(CODE_LENGTH, '0')
}

/**
 * Send a password-reset code only when the email belongs to an existing account.
 */
export async function requestPasswordResetCode({ email, clientKey }) {
  const emailError = validateEmailRequired(email)
  if (emailError) {
    const err = new Error(emailError)
    err.status = 400
    throw err
  }

  const normalized = normalizeEmail(email)
  const user = await findUserByEmail(normalized)
  if (!user) {
    const err = new Error('This email is not registered. Please check it or create an account first.')
    err.status = 404
    throw err
  }

  const rateError = checkForgotRateLimit(`${clientKey || 'anon'}:${normalized}`)
  if (rateError) {
    const err = new Error(rateError)
    err.status = 429
    throw err
  }

  const code = generateCode()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)

  await invalidatePasswordResetCodes(user.id)
  await createPasswordResetCode({
    id: randomUUID(),
    userId: user.id,
    codeHash,
    expiresAt,
  })

  await sendPasswordResetCodeEmail({
    to: normalized,
    code,
    username: user.username,
  })

  return {
    ok: true,
    message: 'Verification code sent. Check your inbox (and spam folder).',
  }
}

export async function resetPasswordWithCode({ email, code, password }) {
  const emailError = validateEmailRequired(email)
  if (emailError) {
    const err = new Error(emailError)
    err.status = 400
    throw err
  }

  const passwordError = validatePassword(password)
  if (passwordError) {
    const err = new Error(passwordError)
    err.status = 400
    throw err
  }

  const normalizedCode = String(code ?? '').trim()
  if (!/^\d{6}$/.test(normalizedCode)) {
    const err = new Error('Enter the 6-digit verification code')
    err.status = 400
    throw err
  }

  const user = await findUserByEmail(normalizeEmail(email))
  if (!user) {
    const err = new Error('Invalid email or verification code')
    err.status = 400
    throw err
  }

  const record = await findActivePasswordResetCode(user.id)
  if (!record) {
    const err = new Error('Invalid or expired verification code')
    err.status = 400
    throw err
  }

  if (Number(record.attempt_count) >= MAX_VERIFY_ATTEMPTS) {
    await invalidatePasswordResetCodes(user.id)
    const err = new Error('Too many invalid attempts. Request a new code.')
    err.status = 429
    throw err
  }

  const matches = await bcrypt.compare(normalizedCode, record.code_hash)
  if (!matches) {
    await incrementPasswordResetAttempts(record.id)
    const err = new Error('Invalid or expired verification code')
    err.status = 400
    throw err
  }

  const passwordHash = await hashPassword(password)
  await updateUserPassword(user.id, passwordHash)
  await markPasswordResetCodeUsed(record.id)
  await invalidatePasswordResetCodes(user.id)

  return {
    ok: true,
    message: 'Password updated. You can sign in with your new password.',
  }
}
