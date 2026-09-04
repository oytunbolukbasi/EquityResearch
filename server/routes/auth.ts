import { Router } from 'express'
import { z } from 'zod'

import {
  clearFailures,
  clearSessionCookie,
  currentUser,
  isThrottled,
  recordFailure,
  setSessionCookie,
  throttleKey,
  verifyPassword,
} from '../lib/auth'

export const authRouter = Router()

const loginInput = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
})

// GET /api/auth/me — who, if anyone, is signed in. Public: the client uses it
// to decide whether to render the Sanal Portföy tab or its login form.
authRouter.get('/me', (req, res) => {
  const username = currentUser(req)
  res.json({ authenticated: username != null, username })
})

// POST /api/auth/login
authRouter.post('/login', (req, res) => {
  const expectedUser = process.env.PORTFOLIO_AUTH_USER
  const expectedHash = process.env.PORTFOLIO_AUTH_HASH
  if (!expectedUser || !expectedHash) {
    res.status(500).json({ error: 'auth_not_configured' })
    return
  }

  const key = throttleKey(req)
  if (isThrottled(key)) {
    res.status(429).json({ error: 'too_many_attempts' })
    return
  }

  const parsed = loginInput.safeParse(req.body)
  if (!parsed.success) {
    recordFailure(key)
    res.status(400).json({ error: 'invalid_body' })
    return
  }

  const { username, password } = parsed.data
  // Always run the hash comparison, even when the username is wrong, so a bad
  // username and a bad password take the same time to answer.
  const passwordOk = verifyPassword(password, expectedHash)
  if (username !== expectedUser || !passwordOk) {
    recordFailure(key)
    res.status(401).json({ error: 'invalid_credentials' })
    return
  }

  clearFailures(key)
  setSessionCookie(res, username)
  res.json({ authenticated: true, username })
})

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res)
  res.json({ authenticated: false })
})
