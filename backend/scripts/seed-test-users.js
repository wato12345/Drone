import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { createUser, findUserByUsername, initDb, listUsers } from '../src/db/index.js'

await initDb()

const accounts = [
  {
    username: 'test_legacy',
    password: 'Test123456',
    email: 'legacy@test.local',
    createdAt: '2026-07-10T08:00:00.000Z',
    note: '注册于 2026-07-18 之前，登录后会弹出广告',
  },
  {
    username: 'test_new',
    password: 'Test123456',
    email: 'new@test.local',
    createdAt: '2026-07-20T08:00:00.000Z',
    note: '注册于 2026-07-18 之后，正常进入无广告',
  },
]

for (const account of accounts) {
  if (await findUserByUsername(account.username)) {
    console.log(`Skip existing user: ${account.username}`)
    continue
  }

  const passwordHash = await bcrypt.hash(account.password, 12)
  await createUser({
    username: account.username,
    email: account.email,
    passwordHash,
    createdAt: account.createdAt,
  })
  console.log(`Created: ${account.username} (${account.note})`)
}

const users = await listUsers()
console.log(`Total users: ${users.length}`)
