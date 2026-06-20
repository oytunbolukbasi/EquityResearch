import type { NextFunction, Request, Response } from 'express'

/** Guards admin POST routes with a shared secret in the x-admin-key header. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_KEY
  if (!expected) {
    res.status(500).json({ error: 'ADMIN_KEY is not configured on the server' })
    return
  }
  if (req.header('x-admin-key') !== expected) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
}
