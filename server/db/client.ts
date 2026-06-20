import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import * as schema from './schema'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in.')
}

// Neon serverless (HTTP) driver — no connection pool to manage, ideal for a
// single Railway service talking to a pooled Neon endpoint.
const sql = neon(databaseUrl)

export const db = drizzle(sql, { schema })
