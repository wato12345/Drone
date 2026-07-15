import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import { createUser, findUserByUsername, getDb, listUsers } from '../src/db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultJsonPath = path.join(__dirname, '../../server/data/users.json')
const jsonPath = process.argv[2] ?? defaultJsonPath

getDb()

if (!fs.existsSync(jsonPath)) {
  console.error(`JSON file not found: ${jsonPath}`)
  process.exit(1)
}

const { users } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
let imported = 0
let skipped = 0

for (const user of users) {
  if (findUserByUsername(user.username)) {
    console.log(`Skip existing user: ${user.username}`)
    skipped++
    continue
  }

  createUser({
    id: user.id,
    username: user.username,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
  })
  console.log(`Imported: ${user.username}`)
  imported++
}

console.log(`Done. imported=${imported}, skipped=${skipped}, total=${listUsers().length}`)
