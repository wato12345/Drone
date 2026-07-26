import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { getDatabaseConfig, initDb } from './db/index.js'
import { createAuthRouter } from './routes/auth.js'
import { createGeocodeRouter } from './routes/geocode.js'
import { createPlanRouter } from './routes/plan.js'

const app = express()
const PORT = Number(process.env.PORT ?? 5001)
const isProd = process.env.NODE_ENV === 'production'
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  const db = getDatabaseConfig()
  res.json({
    status: 'ok',
    database:
      db.driver === 'mysql'
        ? `${db.user}@${db.host}:${db.port}/${db.database}`
        : db.path,
  })
})

app.use('/api/auth', createAuthRouter({ isProd }))
app.use('/api/geocode', createGeocodeRouter())
app.use('/api', createPlanRouter())

app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

await initDb()

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`)
  const dbConfig = getDatabaseConfig()
  console.log(
    `Database: ${
      dbConfig.driver === 'mysql'
        ? `${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
        : dbConfig.path
    }`,
  )
})
