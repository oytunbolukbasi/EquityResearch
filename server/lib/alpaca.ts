const BASE_URL = process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets'

export class AlpacaError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
    this.name = 'AlpacaError'
  }
}

function makeHeaders(): Record<string, string> {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY ?? '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET ?? '',
    'Content-Type': 'application/json',
  }
}

export async function alpacaFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...makeHeaders(),
      ...((options.headers as Record<string, string> | undefined) ?? {}),
    },
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { message?: string; code?: string }
      if (body.message) msg = body.message
    } catch { /* ignore */ }
    throw new AlpacaError(res.status, msg)
  }

  if (res.status === 204) return null
  return res.json() as Promise<T>
}
