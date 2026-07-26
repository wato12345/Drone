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

function toMySqlDateTime(value) {
  if (value instanceof Date) return value
  if (typeof value === 'string') return new Date(value)
  return new Date()
}

export async function createUser({ id, username, email, passwordHash, createdAt }) {
  const userId = id ?? crypto.randomUUID()
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
