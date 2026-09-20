import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Pin, Plus, Trash2 } from 'lucide-react'

import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { useMediaQuery } from '@/lib/use-media-query'

import { Panel, PanelEmpty, TabHeading } from '../workspace/Panel'
import { SplitPane, PHONE_QUERY } from '../workspace/split'
import { Notice } from '../workspace/shared'
import { Skeleton, SkeletonLines } from '@/components/ui/skeleton'
import { SavedFlash } from './SavedFlash'

// The editor is the panel's heaviest module by a wide margin. Loading it here
// keeps it out of the first paint: nothing downloads until this tab is opened.
const NoteEditor = lazy(() => import('./NoteEditor'))

interface Section {
  id: number
  title: string
  position: number
}
interface PageMeta {
  id: number
  sectionId: number
  title: string
  pinned: boolean
  position: number
  updatedAt: string
}

const OPEN_SECTIONS_KEY = 'eqr2:notes-open-sections'
const LAST_PAGE_KEY = 'eqr2:notes-page'

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function NotesTab() {
  const confirm = useConfirm()
  const toast = useToast()

  const [sections, setSections] = useState<Section[]>([])
  const [pages, setPages] = useState<PageMeta[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [body, setBody] = useState<{ id: number; content: unknown[] | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState(0)
  const phone = useMediaQuery(PHONE_QUERY)
  /**
   * Phone: the section list is collapsed by default and names the open page.
   *
   * Stacked, the list sat at full height above the editor — 545px of an 812px
   * screen — so the first thing the Notes tab showed was a list of what it
   * could show, and the note itself started below the fold. Same fix as the
   * bulletin's contents (GÖREV 56); here the row doubles as the page's name.
   */
  const [navOpen, setNavOpen] = useState(false)

  const [openSections, setOpenSections] = useState<Set<number>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(OPEN_SECTIONS_KEY) ?? '[]') as number[])
    } catch {
      return new Set()
    }
  })

  const refresh = useCallback(async () => {
    const d = await api<{ sections: Section[]; pages: PageMeta[] }>('/api/notes')
    setSections(d.sections)
    setPages(d.pages)
    return d
  }, [])

  useEffect(() => {
    let cancelled = false
    refresh()
      .then((d) => {
        if (cancelled) return
        const saved = Number(localStorage.getItem(LAST_PAGE_KEY))
        const pick = d.pages.find((p) => p.id === saved) ?? d.pages[0]
        setActiveId(pick?.id ?? null)
      })
      .catch(() => !cancelled && setError('Notlar yüklenemedi.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [refresh])

  // Bodies load one at a time — see the note on GET /api/notes.
  useEffect(() => {
    if (activeId == null) return void setBody(null)
    let cancelled = false
    localStorage.setItem(LAST_PAGE_KEY, String(activeId))
    api<{ id: number; content: unknown[] | null }>(`/api/notes/pages/${activeId}`)
      .then((p) => !cancelled && setBody({ id: p.id, content: p.content }))
      .catch(() => !cancelled && setError('Sayfa açılamadı.'))
    return () => {
      cancelled = true
    }
  }, [activeId])

  // ── autosave ───────────────────────────────────────────────────────────────
  // Debounced rather than per-keystroke: the editor fires onChange on every
  // character, and a request per character would queue writes behind each other
  // and race on arrival.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveBody = useCallback(
    (id: number, blocks: unknown[]) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        api(`/api/notes/pages/${id}`, { method: 'PATCH', body: JSON.stringify({ content: blocks }) })
          .then(() => setSavedAt(Date.now()))
          .catch(() => setError('Not kaydedilemedi.'))
      }, 800)
    },
    [],
  )
  // A pending save must not be lost when the tab closes or the page changes.
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  // ── mutations ──────────────────────────────────────────────────────────────

  /*
    Creating used to be silent: the row appeared somewhere in the list and you
    had to spot it. On a phone the list is collapsed, so a new section landed
    entirely out of sight. Both now confirm in words, and the phone opens the
    list so the thing you just made is on screen.
  */
  async function addSection() {
    try {
      const row = await api<Section>('/api/notes/sections', {
        method: 'POST',
        body: JSON.stringify({ title: 'Yeni bölüm' }),
      })
      setSections((s) => [...s, row])
      setOpenSections((o) => new Set(o).add(row.id))
      setNavOpen(true)
      toast.success('Bölüm eklendi')
    } catch {
      toast.error('Bölüm eklenemedi')
    }
  }

  async function addPage(sectionId: number) {
    try {
      const row = await api<PageMeta>('/api/notes/pages', {
        method: 'POST',
        body: JSON.stringify({ sectionId }),
      })
      setPages((p) => [...p, row])
      setOpenSections((o) => new Set(o).add(sectionId))
      // The new page opens in the editor, so the phone's list closes behind it
      // — the toast and the row's own title are what say it was created.
      setActiveId(row.id)
      setNavOpen(false)
      toast.success('Sayfa eklendi')
    } catch {
      toast.error('Sayfa eklenemedi')
    }
  }

  async function renameSection(id: number, title: string) {
    setSections((s) => s.map((x) => (x.id === id ? { ...x, title } : x)))
    await api(`/api/notes/sections/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
  }

  async function renamePage(id: number, title: string) {
    setPages((p) => p.map((x) => (x.id === id ? { ...x, title } : x)))
    await api(`/api/notes/pages/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
    setSavedAt(Date.now())
  }

  async function togglePin(page: PageMeta) {
    const pinned = !page.pinned
    setPages((p) => p.map((x) => (x.id === page.id ? { ...x, pinned } : x)))
    await api(`/api/notes/pages/${page.id}`, { method: 'PATCH', body: JSON.stringify({ pinned }) })
  }

  async function removePage(page: PageMeta) {
    const ok = await confirm({
      title: 'Sayfa silinsin mi?',
      body: `"${page.title}" ve içindeki her şey kalıcı olarak silinir.`,
      confirmLabel: 'Sil',
      danger: true,
    })
    if (!ok) return
    setPages((p) => p.filter((x) => x.id !== page.id))
    if (activeId === page.id) setActiveId(null)
    await api(`/api/notes/pages/${page.id}`, { method: 'DELETE' })
  }

  async function removeSection(section: Section) {
    const count = pages.filter((p) => p.sectionId === section.id).length
    const ok = await confirm({
      title: 'Bölüm silinsin mi?',
      body: count
        ? `"${section.title}" ve içindeki ${count} sayfa kalıcı olarak silinir.`
        : `"${section.title}" kalıcı olarak silinir.`,
      confirmLabel: 'Sil',
      danger: true,
    })
    if (!ok) return
    setSections((s) => s.filter((x) => x.id !== section.id))
    setPages((p) => p.filter((x) => x.sectionId !== section.id))
    await api(`/api/notes/sections/${section.id}`, { method: 'DELETE' })
  }

  function toggleSection(id: number) {
    setOpenSections((o) => {
      const next = new Set(o)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const active = pages.find((p) => p.id === activeId) ?? null
  const pinned = pages.filter((p) => p.pinned)

  // ── panels ─────────────────────────────────────────────────────────────────

  /** Picking a page on a phone also closes the list it was picked from. */
  const openPage = (id: number) => {
    setActiveId(id)
    setNavOpen(false)
  }

  const navList = (
    <>
      {loading ? (
        <div className="flex flex-col gap-3 px-[18px] py-4">
          <Skeleton h={11} w="55%" />
          <Skeleton h={11} w="70%" />
          <Skeleton h={11} w="45%" />
        </div>
      ) : sections.length === 0 ? (
        <PanelEmpty>Henüz bölüm yok. Sağ üstteki + ile ekleyin.</PanelEmpty>
      ) : (
        <div className="border-faint2 border-t py-1.5">
          {pinned.length > 0 && (
            <div className="mb-1.5">
              <div className="text-mid px-[18px] pt-1.5 pb-1 text-[11px] tracking-[0.04em] uppercase">
                Sabitlenenler
              </div>
              {pinned.map((p) => (
                <PageRow
                  key={`pin-${p.id}`}
                  page={p}
                  active={p.id === activeId}
                  onOpen={() => openPage(p.id)}
                  onRename={(t) => renamePage(p.id, t)}
                  onPin={() => togglePin(p)}
                  onDelete={() => removePage(p)}
                  showPin
                />
              ))}
            </div>
          )}

          {sections.map((s) => {
            const open = openSections.has(s.id)
            const own = pages.filter((p) => p.sectionId === s.id)
            return (
              <div key={s.id}>
                <SectionRow
                  section={s}
                  open={open}
                  onToggle={() => toggleSection(s.id)}
                  onRename={(t) => renameSection(s.id, t)}
                  onAddPage={() => addPage(s.id)}
                  onDelete={() => removeSection(s)}
                />
                {open &&
                  (own.length === 0 ? (
                    <div className="text-mid px-[18px] py-1.5 pl-[38px] text-[12px]">
                      Sayfa yok
                    </div>
                  ) : (
                    own.map((p) => (
                      <PageRow
                        key={p.id}
                        page={p}
                        active={p.id === activeId}
                        onOpen={() => openPage(p.id)}
                        onRename={(t) => renamePage(p.id, t)}
                        onPin={() => togglePin(p)}
                        onDelete={() => removePage(p)}
                      />
                    ))
                  ))}
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  const sidebar = (
    <Panel
      side="a"
      title="Notlar"
      right={
        <button
          onClick={addSection}
          title="Bölüm ekle"
          className="text-mid hover:text-ink cursor-pointer border-0 bg-transparent p-1 leading-none"
        >
          <Plus className="size-[15px]" />
        </button>
      }
      padded={false}
      maxBodyHeight={phone ? undefined : '70vh'}
    >
      {navList}
    </Panel>
  )

  /** Phone: one row that names the open page and holds the list behind it. */
  const phoneNav = (
    <div className="bg-card border-faint mb-4 rounded-xl border">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          className="text-ink flex min-h-[46px] flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent px-[14px] py-3 text-left text-[13px] font-medium"
        >
          <span className="flex-1 truncate">{active ? active.title : 'Notlar'}</span>
          {navOpen ? (
            <ChevronDown className="text-mid size-4 shrink-0" />
          ) : (
            <ChevronRight className="text-mid size-4 shrink-0" />
          )}
        </button>
        <button
          onClick={addSection}
          title="Bölüm ekle"
          aria-label="Bölüm ekle"
          className="text-mid min-h-[46px] cursor-pointer border-0 bg-transparent px-[14px] leading-none"
        >
          <Plus className="size-[17px]" />
        </button>
      </div>
      {navOpen && <div className="border-faint border-t pb-1.5">{navList}</div>}
    </div>
  )

  const editorPanel = (
    <Panel
      side="b"
      title={
        active ? (
          <InlineTitle
            key={active.id}
            value={active.title}
            onCommit={(t) => renamePage(active.id, t)}
            className="text-[14px] font-semibold"
          />
        ) : (
          'Sayfa'
        )
      }
      right={<SavedFlash at={savedAt} />}
      maxBodyHeight={phone ? undefined : '70vh'}
    >
      {!active ? (
        <PanelEmpty>Soldan bir sayfa seçin ya da yeni bir sayfa ekleyin.</PanelEmpty>
      ) : !body || body.id !== active.id ? (
        <div className="flex flex-col gap-4 px-[18px] py-4">
          <Skeleton h={22} w="45%" />
          <SkeletonLines lines={4} />
          <SkeletonLines lines={3} />
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex flex-col gap-4 px-[18px] py-4">
              <Skeleton h={22} w="45%" />
              <SkeletonLines lines={4} />
            </div>
          }
        >
          <NoteEditor
            pageId={active.id}
            initialContent={body.content}
            onChange={(blocks) => saveBody(active.id, blocks)}
          />
        </Suspense>
      )}
    </Panel>
  )

  return (
    <div>
      <TabHeading
        title="Notlar"
        subtitle="Panel güncellemeleri, fikirler ve kendi notların."
      />
      {error && <Notice>{error}</Notice>}
      {phone ? (
        <>
          {phoneNav}
          {editorPanel}
        </>
      ) : (
        <SplitPane splitKey="notes" a={sidebar} b={editorPanel} />
      )}
    </div>
  )
}

// ─── sidebar rows ────────────────────────────────────────────────────────────

function SectionRow({
  section,
  open,
  onToggle,
  onRename,
  onAddPage,
  onDelete,
}: {
  section: Section
  open: boolean
  onToggle: () => void
  onRename: (title: string) => void
  onAddPage: () => void
  onDelete: () => void
}) {
  return (
    <div className="group hover:bg-bg relative flex items-center gap-1 px-[18px] py-1.5">
      <button
        onClick={onToggle}
        aria-label={open ? 'Daralt' : 'Genişlet'}
        className="text-mid shrink-0 cursor-pointer border-0 bg-transparent p-0 leading-none"
      >
        {open ? <ChevronDown className="size-[14px]" /> : <ChevronRight className="size-[14px]" />}
      </button>
      <InlineTitle value={section.title} onCommit={onRename} className="flex-1 text-[13px] font-medium" />
      <RowActions>
        <IconBtn title="Sayfa ekle" onClick={onAddPage}>
          <Plus className="size-[13px]" />
        </IconBtn>
        <IconBtn title="Bölümü sil" onClick={onDelete} danger>
          <Trash2 className="size-[13px]" />
        </IconBtn>
      </RowActions>
    </div>
  )
}

/**
 * A page row carries two jobs its section row does not have to reconcile.
 *
 * A section's title is only ever a title — the chevron owns expand/collapse —
 * so it can be a text box that you click straight into. A page's title IS the
 * button that opens the page, so the same treatment would make one click mean
 * two things: you would aim to open a note and land a caret in its name.
 *
 * Renaming therefore gets its own trigger: the pencil in the hover actions,
 * which is where this panel already puts per-row verbs (GÖREV 47), plus
 * double-click on the title for anyone who reaches for that out of habit.
 * While editing, the row stops opening on click — a click at that point is
 * aimed at the text.
 */
function PageRow({
  page,
  active,
  onOpen,
  onRename,
  onPin,
  onDelete,
  showPin,
}: {
  page: PageMeta
  active: boolean
  onOpen: () => void
  onRename: (title: string) => void
  onPin: () => void
  onDelete: () => void
  showPin?: boolean
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div
      className="group hover:bg-bg relative flex items-center gap-1.5 py-1.5 pr-[18px] pl-[38px]"
      style={{ background: active ? 'var(--bg)' : undefined }}
    >
      {showPin && <Pin className="text-mid size-[12px] shrink-0" aria-hidden="true" />}
      {editing ? (
        <InlineTitle
          value={page.title}
          autoFocus
          onCommit={(t) => onRename(t)}
          onDone={() => setEditing(false)}
          className="flex-1 text-[13px]"
        />
      ) : (
        <button
          onClick={onOpen}
          onDoubleClick={() => setEditing(true)}
          className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[13px]"
          style={{ color: active ? 'var(--ink)' : 'var(--mid)' }}
        >
          {page.title}
        </button>
      )}
      <RowActions>
        <IconBtn title="Yeniden adlandır" onClick={() => setEditing(true)}>
          <Pencil className="size-[13px]" />
        </IconBtn>
        <IconBtn title={page.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'} onClick={onPin}>
          <Pin className="size-[13px]" style={{ color: page.pinned ? 'var(--info)' : undefined }} />
        </IconBtn>
        <IconBtn title="Sayfayı sil" onClick={onDelete} danger>
          <Trash2 className="size-[13px]" />
        </IconBtn>
      </RowActions>
    </div>
  )
}

/** Same idea as the positions table (GÖREV 47): actions appear on hover only. */
function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
      {children}
    </span>
  )
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="hover:bg-faint2 cursor-pointer rounded-md border-0 bg-transparent p-1 leading-none transition-colors"
      style={{ color: danger ? 'var(--down)' : 'var(--mid)' }}
    >
      {children}
    </button>
  )
}

/**
 * Click-to-rename. A `contentEditable` span rather than an input swapped in on
 * click: the row keeps its exact layout while editing, so nothing shifts under
 * the pointer at the moment you aim at it.
 */
function InlineTitle({
  value,
  onCommit,
  onDone,
  autoFocus,
  className = '',
}: {
  value: string
  onCommit: (title: string) => void
  /** Called after commit or cancel, for callers that mount this only while editing. */
  onDone?: () => void
  autoFocus?: boolean
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  // Focus AND select: this opens on an existing name, and the first thing most
  // people do is replace it. Landing a bare caret would make them clear it by
  // hand.
  useEffect(() => {
    if (!autoFocus || !ref.current) return
    const el = ref.current
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [autoFocus])

  // Enter used to commit only indirectly, by blurring and letting the blur
  // handler do the work. That made a keystroke depend on a focus event, and a
  // focus event depends on the window actually holding focus — it does not
  // fire at all in an unfocused window, so the rename was silently dropped.
  // Enter now commits on its own; blur stays as the click-away path, and this
  // latch keeps the two from saving the same edit twice.
  const settled = useRef(false)

  function commit() {
    if (settled.current) return
    settled.current = true
    const next = (ref.current?.textContent ?? '').trim()
    if (!next || next === value) {
      if (ref.current) ref.current.textContent = value
    } else {
      onCommit(next)
    }
    onDone?.()
  }

  function cancel() {
    if (settled.current) return
    settled.current = true
    if (ref.current) ref.current.textContent = value
    onDone?.()
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      // Both reset the latch, because either can be the start of a fresh edit
      // and neither is guaranteed: focus events do not fire in an unfocused
      // window, which is the case this whole latch exists to survive.
      onFocus={() => {
        settled.current = false
      }}
      onInput={() => {
        settled.current = false
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          ref.current?.blur()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
          ref.current?.blur()
        }
      }}
      className={`focus:border-info min-w-0 truncate rounded border border-transparent px-1 outline-none ${className}`}
    >
      {value}
    </span>
  )
}
