import { randomUUID } from 'node:crypto'
import mysql from 'mysql2/promise'

const DEFAULTS = {
  host: '127.0.0.1',
  port: 3305,
  user: 'drone_app',
  password: 'drone_dev_password',
  database: 'drone_path_planner',
}

let pool

export function getDatabaseConfig() {
  // Railway MySQL plugin uses MYSQLHOST / MYSQLUSER / …; local .env uses MYSQL_HOST.
  return {
    host: process.env.MYSQL_HOST ?? process.env.MYSQLHOST ?? DEFAULTS.host,
    port: Number(process.env.MYSQL_PORT ?? process.env.MYSQLPORT ?? DEFAULTS.port),
    user: process.env.MYSQL_USER ?? process.env.MYSQLUSER ?? DEFAULTS.user,
    password: process.env.MYSQL_PASSWORD ?? process.env.MYSQLPASSWORD ?? DEFAULTS.password,
    database: process.env.MYSQL_DATABASE ?? process.env.MYSQLDATABASE ?? DEFAULTS.database,
    driver: 'mysql',
  }
}

async function initSchema(database) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      username VARCHAR(32) NOT NULL,
      email VARCHAR(255) NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_users_username (username),
      UNIQUE KEY uk_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await database.query(`
    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      used_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reset_user (user_id),
      CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Drop legacy column from earlier draft schema if present
  const [columns] = await database.query(
    `
      SELECT COLUMN_NAME AS name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'password_reset_codes'
        AND COLUMN_NAME = 'code_lookup'
    `,
  )
  if (columns.length > 0) {
    await database.query('ALTER TABLE password_reset_codes DROP COLUMN code_lookup')
  }
}

export async function initDb() {
  if (!pool) {
    const config = getDatabaseConfig()
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    })
    await initSchema(pool)
  }
  return pool
}

export function getDb() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDb() before using the database.')
  }
  return pool
}

export function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }
}

export async function findUserByUsername(username) {
  const [rows] = await getDb().query(
    'SELECT * FROM users WHERE LOWER(username) = LOWER(:username) LIMIT 1',
    { username },
  )
  return rows[0] ?? null
}

export async function findUserById(id) {
  const [rows] = await getDb().query('SELECT * FROM users WHERE id = :id LIMIT 1', { id })
  return rows[0] ?? null
}

export async function findUserByEmail(email) {
  const [rows] = await getDb().query(
    'SELECT * FROM users WHERE email IS NOT NULL AND LOWER(email) = LOWER(:email) LIMIT 1',
    { email },
  )
  return rows[0] ?? null
}

export async function updateUserPassword(userId, passwordHash) {
  await getDb().query('UPDATE users SET password_hash = :passwordHash WHERE id = :userId', {
    userId,
    passwordHash,
  })
}

export async function invalidatePasswordResetCodes(userId) {
  await getDb().query(
    `
      UPDATE password_reset_codes
      SET used_at = COALESCE(used_at, UTC_TIMESTAMP())
      WHERE user_id = :userId AND used_at IS NULL
    `,
    { userId },
  )
}

export async function createPasswordResetCode({ id, userId, codeHash, expiresAt }) {
  await getDb().query(
    `
      INSERT INTO password_reset_codes
        (id, user_id, code_hash, expires_at, attempt_count, used_at, created_at)
      VALUES
        (:id, :userId, :codeHash, :expiresAt, 0, NULL, UTC_TIMESTAMP())
    `,
    {
      id,
      userId,
      codeHash,
      expiresAt: toMySqlUtcDateTime(expiresAt),
    },
  )
}

export async function findActivePasswordResetCode(userId) {
  const [rows] = await getDb().query(
    `
      SELECT *
      FROM password_reset_codes
      WHERE user_id = :userId
        AND used_at IS NULL
        AND expires_at > UTC_TIMESTAMP()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    { userId },
  )
  return rows[0] ?? null
}

export async function incrementPasswordResetAttempts(id) {
  await getDb().query(
    'UPDATE password_reset_codes SET attempt_count = attempt_count + 1 WHERE id = :id',
    { id },
  )
}

export async function markPasswordResetCodeUsed(id) {
  await getDb().query(
    'UPDATE password_reset_codes SET used_at = UTC_TIMESTAMP() WHERE id = :id',
    { id },
  )
}

function toMySqlDateTime(value) {
  if (value instanceof Date) return value
  if (typeof value === 'string') return new Date(value)
  return new Date()
}

/** Store timestamps in UTC so they compare correctly with UTC_TIMESTAMP(). */
function toMySqlUtcDateTime(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now())
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export async function createUser({ id, username, email, passwordHash, createdAt }) {
  const userId = id ?? randomUUID()
  try {
    await getDb().query(
      `
        INSERT INTO users (id, username, email, password_hash, created_at)
        VALUES (:id, :username, :email, :passwordHash, :createdAt)
      `,
      {
        id: userId,
        username,
        email: email ?? null,
        passwordHash,
        createdAt: toMySqlDateTime(createdAt),
      },
    )
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ER_DUP_ENTRY') {
      const message = String(err.message).includes('uk_users_email') ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN'
      throw new Error(message)
    }
    throw err
  }

  return findUserById(userId)
}

export async function listUsers() {
  const [rows] = await getDb().query('SELECT * FROM users ORDER BY created_at ASC')
  return rows
}
