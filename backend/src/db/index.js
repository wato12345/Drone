import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = path.join(__dirname, '../..')
const DATA_DIR = path.join(BACKEND_ROOT, 'data')
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(BACKEND_ROOT, process.env.DATABASE_PATH)
  : path.join(DATA_DIR, 'app.db')

let db

function ensureDataDir() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `)
}

export function getDb() {
  if (!db) {
    ensureDataDir()
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

export function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
  }
}

export function findUserByUsername(username) {
  return getDb()
    .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
    .get(username)
}

export function findUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id)
}

export function createUser({ id, username, email, passwordHash, createdAt }) {
  const userId = id ?? crypto.randomUUID()
  const stmt = getDb().prepare(`
    INSERT INTO users (id, username, email, password_hash, created_at)
    VALUES (@id, @username, @email, @passwordHash, @createdAt)
  `)

  try {
    stmt.run({
      id: userId,
      username,
      email: email ?? null,
      passwordHash,
      createdAt: createdAt ?? new Date().toISOString(),
    })
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const message = err.message.includes('users.email') ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN'
        throw new Error(message)
      }
    }
    throw err
  }

  return findUserById(userId)
}

export function listUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY created_at ASC').all()
}

export { DB_PATH }
