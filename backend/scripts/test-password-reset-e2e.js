/**
 * End-to-end password reset test:
 * ensure user → send Resend code → reset via API → login with new password
 *
 * Usage: node scripts/test-password-reset-e2e.js
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  createPasswordResetCode,
  createUser,
  findUserByEmail,
  findUserByUsername,
  initDb,
  invalidatePasswordResetCodes,
  updateUserPassword,
} from '../src/db/index.js'
import { hashPassword } from '../src/services/auth.js'
import { sendPasswordResetCodeEmail, getResendConfig } from '../src/services/resend.js'

const API = process.env.E2E_API_BASE ?? 'http://localhost:5001/api'
const EMAIL = process.env.E2E_RESET_EMAIL ?? 'wato12345@126.com'
const USERNAME = process.env.E2E_RESET_USERNAME ?? 'e2e_reset'
const OLD_PASSWORD = 'OldPass123!'
const NEW_PASSWORD = 'NewPass456!'
const CODE = String(Math.floor(100000 + Math.random() * 900000))

async function api(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  return { status: response.status, data }
}

async function ensureUser() {
  let user = await findUserByEmail(EMAIL)
  if (user) {
    await updateUserPassword(user.id, await hashPassword(OLD_PASSWORD))
    console.log(`✓ using existing user ${user.username} <${EMAIL}>`)
    return user
  }

  user = await findUserByUsername(USERNAME)
  if (user) {
    // Attach email if missing / update password
    const db = (await import('../src/db/index.js')).getDb()
    await db.query('UPDATE users SET email = :email, password_hash = :passwordHash WHERE id = :id', {
      id: user.id,
      email: EMAIL,
      passwordHash: await hashPassword(OLD_PASSWORD),
    })
    console.log(`✓ updated user ${USERNAME} email → ${EMAIL}`)
    return findUserByEmail(EMAIL)
  }

  user = await createUser({
    id: randomUUID(),
    username: USERNAME,
    email: EMAIL,
    passwordHash: await hashPassword(OLD_PASSWORD),
  })
  console.log(`✓ created user ${USERNAME} <${EMAIL}>`)
  return user
}

async function main() {
  console.log('--- Password reset E2E ---')
  const resend = getResendConfig()
  console.log(`Resend from: ${resend.from}`)
  console.log(`API: ${API}`)
  console.log(`Email: ${EMAIL}`)

  if (!resend.configured) {
    throw new Error('RESEND_API_KEY missing')
  }

  await initDb()
  const user = await ensureUser()

  // 1) Health
  const health = await fetch(`${API}/health`).then((r) => r.json())
  console.log('✓ health', health.status)

  // 2) Old password still works
  const loginOld = await api('/auth/login', { username: user.username, password: OLD_PASSWORD })
  if (loginOld.status !== 200) {
    throw new Error(`login with old password failed: ${JSON.stringify(loginOld.data)}`)
  }
  console.log('✓ login with old password')

  // 3) Forgot-password HTTP route (generic success; may send a real code too)
  const forgot = await api('/auth/forgot-password', { email: EMAIL })
  if (forgot.status !== 200 || !forgot.data.ok) {
    throw new Error(`forgot-password failed: ${JSON.stringify(forgot.data)}`)
  }
  console.log('✓ POST /auth/forgot-password →', forgot.data.message)

  // 4) Replace with a known code and send that code via Resend (so we can finish E2E)
  await invalidatePasswordResetCodes(user.id)
  const codeHash = await bcrypt.hash(CODE, 10)
  await createPasswordResetCode({
    id: randomUUID(),
    userId: user.id,
    codeHash,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  })
  const sendResult = await sendPasswordResetCodeEmail({
    to: EMAIL,
    code: CODE,
    username: user.username,
  })
  console.log('✓ Resend email sent', sendResult?.id ? `(id ${sendResult.id})` : '')
  console.log(`  code for this E2E run: ${CODE}`)

  // 5) Reset password via HTTP
  const reset = await api('/auth/reset-password', {
    email: EMAIL,
    code: CODE,
    password: NEW_PASSWORD,
  })
  if (reset.status !== 200 || !reset.data.ok) {
    throw new Error(`reset-password failed: ${JSON.stringify(reset.data)}`)
  }
  console.log('✓ POST /auth/reset-password →', reset.data.message)

  // 6) Old password must fail
  const loginOldAgain = await api('/auth/login', { username: user.username, password: OLD_PASSWORD })
  if (loginOldAgain.status === 200) {
    throw new Error('old password still works after reset')
  }
  console.log('✓ old password rejected')

  // 7) New password login
  const loginNew = await api('/auth/login', { username: user.username, password: NEW_PASSWORD })
  if (loginNew.status !== 200) {
    throw new Error(`login with new password failed: ${JSON.stringify(loginNew.data)}`)
  }
  console.log('✓ login with new password')

  // 8) Wrong code should fail (request a fresh code then try bad code)
  await invalidatePasswordResetCodes(user.id)
  await createPasswordResetCode({
    id: randomUUID(),
    userId: user.id,
    codeHash: await bcrypt.hash('111111', 10),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  })
  const bad = await api('/auth/reset-password', {
    email: EMAIL,
    code: '000000',
    password: 'AnotherPass789!',
  })
  if (bad.status === 200) {
    throw new Error('wrong code was accepted')
  }
  console.log('✓ wrong code rejected')

  console.log('\nE2E PASSED')
  console.log(`Check inbox ${EMAIL} for the verification email from ${resend.from}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('\nE2E FAILED')
  console.error(err)
  process.exit(1)
})
