import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import pino from 'pino'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { dbURL, eventsApi } from '#server/common/env'
import eventRoutes from '#server/routes/eventRoutes'
import walletRoutes from '#server/routes/walletRoutes'

// ✅ Initialize Express & Logger
const app = express()

export const logger = pino({ transport: { target: 'pino-pretty' } })

const pool = new pg.Pool({
  connectionString: dbURL,
  max: 25, // Supports concurrent queries under high load
})

export const db = drizzle(pool)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// ✅ Health check for Google Cloud Run
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'et-betting-api' })
})

// ✅ Use modular routes
app.use(eventsApi, eventRoutes)
app.use('/api/wallet', walletRoutes)

// ✅ Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err, 'Unhandled server error')
  res.status(500).json({ error: 'Internal server error' })
})

export default app
