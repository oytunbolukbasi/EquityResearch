import { useEffect, useRef } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'

import { useTheme } from '@/lib/theme'

// Deliberately NOT importing '@blocknote/core/fonts/inter.css': the panel
// already loads Inter, and that stylesheet pulls the whole family again —
// about 200 kB of woff2 for a font the page has had since it opened.
import '@blocknote/mantine/style.css'
import './note-editor.css'

/**
 * The editor itself, kept in its own module so it can be code-split.
 *
 * It is the heaviest thing in the panel by a distance — measured at 345 kB
 * gzipped against 158 kB for the entire rest of the app — so `NotesTab` loads
 * it lazily and the panel's opening weight is unchanged. Nothing here may be
 * imported from a module that runs on first paint, or that saving is undone.
 */
export default function NoteEditor({
  pageId,
  initialContent,
  onChange,
}: {
  /** Remounts the editor when the page changes — see below. */
  pageId: number
  initialContent: unknown[] | null
  onChange: (blocks: unknown[]) => void
}) {
  const { theme } = useTheme()

  const editor = useCreateBlockNote({
    // An empty array is not a valid document; BlockNote wants undefined for
    // "start blank", and a fresh page has no content yet.
    initialContent:
      initialContent && initialContent.length
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (initialContent as any)
        : undefined,
  })

  // `onChange` is read through a ref so the subscription below does not need it
  // in its dependencies — re-subscribing on every parent render would drop
  // edits typed between the unsubscribe and the next attach.
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    return editor.onChange(() => cb.current(editor.document))
  }, [editor])

  return (
    <BlockNoteView
      key={pageId}
      editor={editor}
      theme={theme === 'dark' ? 'dark' : 'light'}
      className="eqr-note-editor"
    />
  )
}
