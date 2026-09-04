import { useCallback, useEffect, useState } from 'react'

import { getDeviceKey } from '@/lib/device-key'
import {
  applyWorkspaceLayout,
  isWorkspaceLayout,
  readWorkspaceLayout,
  resetWorkspaceLayout,
} from './split'

/**
 * Marks a `layouts` row as written by the tabbed workspace. The table predates
 * this redesign and still holds react-grid-layout rows, so the restore path has
 * to be able to tell them apart — `items` carries the tag and `layout` the data.
 */
const SCHEMA_TAG = 'workspace-v1'

/**
 * Layout persistence has two tiers:
 *
 *  - localStorage, written automatically the moment a divider is released or
 *    two panels swap. This is what makes a plain page reload look unchanged.
 *  - the `layouts` table, written only when the user presses Kaydet. It is
 *    keyed by device+browser and survives a cleared cache or a new profile,
 *    and it is what the app restores on load.
 *
 * Keeping the explicit save means an accidental drag never overwrites the
 * arrangement you deliberately settled on — the same contract the old dashboard
 * had, so the buttons behave the way they always did.
 */
export function useLayoutPersistence() {
  const [saved, setSaved] = useState(false)

  // Restore this device's saved arrangement once on load. Anything missing,
  // malformed, or left over from the old grid dashboard is ignored, leaving the
  // localStorage/default layout already on screen untouched.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/layouts?deviceKey=${encodeURIComponent(getDeviceKey())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row: { items?: unknown; layout?: unknown } | null) => {
        if (cancelled || !row) return
        const tagged =
          Array.isArray(row.items) &&
          row.items.some((i) => (i as { schema?: string })?.schema === SCHEMA_TAG)
        if (!tagged) return
        const payload = Array.isArray(row.layout) ? row.layout[0] : row.layout
        if (isWorkspaceLayout(payload)) applyWorkspaceLayout(payload)
      })
      .catch(() => {
        /* offline or endpoint down — the local layout is already correct */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(async () => {
    try {
      const res = await fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceKey: getDeviceKey(),
          items: [{ schema: SCHEMA_TAG }],
          layout: [readWorkspaceLayout()],
        }),
      })
      if (!res.ok) return false
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      return true
    } catch {
      return false
    }
  }, [])

  const reset = useCallback(() => resetWorkspaceLayout(), [])

  return { save, reset, saved }
}
