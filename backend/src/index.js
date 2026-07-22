import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { DB_PATH, getDb } from './db/index.js'
import { createAuthRouter } from './routes/auth.js'
import { createGeocodeRouter } from './routes/geocode.js'
import { createPlanRouter } from './routes/plan.js'

const app = express()
const PORT = process.env.PORT ?? 5001
const isProd = process.env.NODE_ENV === 'production'

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

getDb()

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: DB_PATH })
})

app.use('/api/auth', createAuthRouter({ isProd }))
app.use('/api/geocode', createGeocodeRouter())
app.use('/api', createPlanRouter())

app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`)
  console.log(`Database: ${DB_PATH}`)
})
