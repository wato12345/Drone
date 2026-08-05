import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import 'dotenv/config'
import { createUser, findUserByUsername, initDb, listUsers } from '../src/db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = path.join(__dirname, '..')
const SQLITE_PATH = process.env.DATABASE_PATH
  ? path.resolve(BACKEND_ROOT, process.env.DATABASE_PATH)
  : path.join(BACKEND_ROOT, 'data/app.db')

if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`SQLite file not found: ${SQLITE_PATH}`)
  process.exit(1)
}

const sqlite = new Database(SQLITE_PATH, { readonly: true })
const rows = sqlite.prepare('SELECT * FROM users ORDER BY created_at ASC').all()

await initDb()

let imported = 0
let skipped = 0

for (const row of rows) {
  if (await findUserByUsername(row.username)) {
    console.log(`Skip existing user: ${row.username}`)
    skipped++
    continue
  }

  await createUser({
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  })
  console.log(`Imported: ${row.username}`)
  imported++
}

const users = await listUsers()
console.log(`Done. imported=${imported}, skipped=${skipped}, total=${users.length}`)
