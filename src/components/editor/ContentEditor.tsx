import { useEffect, useState } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { X, BookOpen, Loader2 } from 'lucide-react'
import { useCardStore } from '../../store/cardStore'
import { useUiStore } from '../../store/uiStore'
import { clearSearchCache } from '../../hooks/useSearch'
import { contentMap, contentDirty, getCurrentFileBlob } from '../../hooks/useAutoSave'
import { loadCardContent } from '../../file/boardReader'

// ── Inner editor — rendered only once content is ready ────────────────────────

type Block = PartialBlock

interface EditorInnerProps {
  cardId: string
  initialContent: Block[] | undefined
}

function EditorInner({ cardId, initialContent }: EditorInnerProps) {
  const updateCard = useCardStore((s) => s.updateCard)
  const theme = useUiStore((s) => s.theme)
  const editor = useCreateBlockNote({
    initialContent: initialContent?.length ? initialContent : undefined,
  })

  // Persist content to contentMap on every change so auto-save can pick it up
  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      contentMap.set(cardId, editor.document)
      contentDirty.add(cardId)
      clearSearchCache(cardId)
      updateCard(cardId, { hasContent: true })
    })
    return unsubscribe
  }, [editor, cardId, updateCard])

  return <BlockNoteView editor={editor} theme={theme} style={{ minHeight: '100%' }} />
}

// ── Container — handles async content loading ─────────────────────────────────

interface Props {
  cardId: string
  onClose: () => void
}

export function ContentEditor({ cardId, onClose }: Props) {
  const card = useCardStore((s) => s.cards.find((c) => c.id === cardId))
  // Already in memory (edited this session)? Then there is nothing to load.
  const [initialContent, setInitialContent] = useState<Block[] | undefined>(() => contentMap.get(cardId) as Block[] | undefined)
  const [loaded, setLoaded] = useState(() => contentMap.has(cardId) || !card?.hasContent || !getCurrentFileBlob())

  useEffect(() => {
    if (loaded) return
    // Stored in the ZIP from a previous session
    loadCardContent(getCurrentFileBlob()!, cardId)
      .then((doc) => {
        if (Array.isArray(doc) && doc.length) {
          contentMap.set(cardId, doc)
          setInitialContent(doc as Block[])
        }
      })
      .catch(() => {
        /* start fresh */
      })
      .finally(() => setLoaded(true))
  }, [cardId, loaded])

  // Dismiss on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="z-50 fixed inset-0 flex flex-col bg-[var(--c-canvas)]">
      {/* Header */}
      <div className="flex items-center gap-3 bg-[var(--c-surface)] px-4 border-[color:var(--c-border)] border-b h-10 shrink-0">
        <BookOpen size={14} className="text-amber-400" />
        <span className="font-medium text-[color:var(--c-text)] text-sm truncate">{card?.title}</span>
        <span className="font-mono text-[color:var(--c-text-faint)] text-[0.6875rem]">· detail</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-[color:var(--c-text-muted)] hover:text-[color:var(--c-text)] transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Editor area */}
      {!loaded ? (
        <div className="flex flex-1 justify-center items-center gap-2 text-[color:var(--c-text-faint)]">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto px-4 py-10 max-w-3xl">
            <EditorInner cardId={cardId} initialContent={initialContent} />
          </div>
        </div>
      )}
    </div>
  )
}
