import 'dotenv/config'
import { existsSync } from 'node:fs'
import path from 'node:path'

import express, { type ErrorRequestHandler, Router } from 'express'

import { morningNotesRouter } from './routes/morning-notes'
import { ideasRouter } from './routes/ideas'
import { tradePlansRouter } from './routes/trade-plans'
import { bulkImportRouter } from './routes/bulk-import'
import { portfolioRouter } from './routes/portfolio'
import { portfolioManageRouter } from './routes/portfolio-manage'
import { paperTradingRouter } from './routes/paper-trading'
import { layoutsRouter } from './routes/layouts'
import { authRouter } from './routes/auth'
import { requireSession } from './lib/auth'
import { startPriceScheduler } from './services/price-scheduler'

const app = express()
app.use(express.json({ limit: '2mb' }))
// Session cookies are signed application-side (server/lib/auth.ts), so Express
// only needs to know it sits behind Railway's proxy for `secure` cookies and
// req.ip (login throttling) to be correct.
app.set('trust proxy', 1)

const api = Router()
api.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

// ─── open, by necessity ──────────────────────────────────────────────────────
// Two things mount BEFORE the session gate, and only these two.
//
//   /auth   — you cannot log in through a door that requires being logged in.
//   /admin  — the content pipeline's own door, held by `x-admin-key`. It is a
//             separate mechanism on purpose and the two are never mixed: an
//             admin key does not open the panel, and a session does not open
//             the importer.
api.use('/auth', authRouter)
api.use('/admin/bulk-import', bulkImportRouter)

// ─── everything past here needs a session ────────────────────────────────────
// The panel used to be readable by anyone who knew the URL; only writes were
// guarded. One user, one door — so the read routes are behind it too, and a
// locked front door is not worth much if the windows still open.
api.use(requireSession)

api.use('/morning-notes', morningNotesRouter)
api.use('/ideas', ideasRouter)
api.use('/trade-plans', tradePlansRouter)
api.use('/portfolio', portfolioRouter)
api.use('/portfolio/manage', portfolioManageRouter)
api.use('/paper-trading', paperTradingRouter)
api.use('/layouts', layoutsRouter)
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
  // Takes over the price refresh the PortfoyTakip app used to run.
  startPriceScheduler()
})
