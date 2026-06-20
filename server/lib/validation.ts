import type { ZodType } from 'zod'

/**
 * Admin POST bodies may be a single record or an array of records (paste one
 * idea or a whole day's worth). Normalize to an array and validate each.
 */
export function parseRecords<T>(
  schema: ZodType<T>,
  body: unknown,
): { ok: true; data: T[] } | { ok: false; issues: unknown } {
  const list = Array.isArray(body) ? body : [body]
  if (list.length === 0) return { ok: false, issues: 'empty body' }
  const data: T[] = []
  for (const item of list) {
    const parsed = schema.safeParse(item)
    if (!parsed.success) return { ok: false, issues: parsed.error.issues }
    data.push(parsed.data)
  }
  return { ok: true, data }
}
