import 'dotenv/config'
import { existsSync } from 'node:fs'
import path from 'node:path'

import express, { type ErrorRequestHandler, Router } from 'express'

import { morningNotesRouter } from './routes/morning-notes'
import { ideasRouter } from './routes/ideas'
import { tradePlansRouter } from './routes/trade-plans'
import { heatmapsRouter } from './routes/heatmaps'
import { bulkImportRouter } from './routes/bulk-import'
import { portfolioRouter } from './routes/portfolio'

const app = express()
app.use(express.json({ limit: '2mb' }))

const api = Router()
api.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})
api.use('/morning-notes', morningNotesRouter)
api.use('/ideas', ideasRouter)
api.use('/trade-plans', tradePlansRouter)
api.use('/heatmaps', heatmapsRouter)
api.use('/admin/bulk-import', bulkImportRouter)
api.use('/portfolio', portfolioRouter)
app.use('/api', api)

// In production this single service also serves the built client.
const clientDist = path.resolve(import.meta.dirname, '../dist/public')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  // SPA fallback — Express 5 dislikes bare "*" route patterns, so use a
  // catch-all middleware for non-API GETs instead.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next()
      return
    }
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal_error' })
}
app.use(errorHandler)

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`API${existsSync(clientDist) ? ' + static client' : ''} listening on http://localhost:${port}`)
})
