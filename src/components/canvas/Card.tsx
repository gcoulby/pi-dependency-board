import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlignLeft, BookOpen, Paperclip, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import type { Card as CardModel, CardType } from '../../types'
import { EXTERNAL_LANE_ID } from '../../types'
import { CARD_TYPE_ICONS, cardTypeStyle } from '../../lib/cardTypeStyle'

export interface CardNodeData extends Record<string, unknown> {
  card: CardModel
  type: CardType | undefined
  dimmed: boolean
  /** Dependencies that need this card (it is `from`). */
  outCount: number
  /** Name of the owning team, if any. */
  ownerName?: string
  /** Dependencies this card waits on (it is `to`). */
  inCount: number
}

export const Card = memo(({ data, selected }: NodeProps) => {
  const { card, type, dimmed, outCount, inCount, ownerName } = data as CardNodeData
  const style = cardTypeStyle(type?.colour ?? '#8b949e')
  const Icon = CARD_TYPE_ICONS[type?.icon ?? 'Layers'] ?? CARD_TYPE_ICONS.Layers
  const external = card.laneId === EXTERNAL_LANE_ID
  const hasDesc = Boolean(card.description?.trim())
  const hasAttachments = (card.attachments?.length ?? 0) > 0

  return (
    <div
      className="relative w-full h-full transition-opacity duration-150 select-none"
      style={{ opacity: dimmed ? 0.22 : 1, fontSize: 'calc(16px * var(--fs, 1))' }}
    >
      {/* Handles sit outside the clipped box, or their outer half is unreachable */}
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
    <div
      className="relative w-full h-full rounded overflow-hidden bg-[var(--c-surface)]"
      style={{
        border: `1px ${external ? 'dashed' : 'solid'} ${selected ? '#fbbf24' : style.border}`,
        boxShadow: selected ? '0 0 0 2px rgba(251,191,36,0.2)' : undefined,
      }}
    >

      <div className="absolute inset-0" style={{ background: style.bg }} />
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: style.bar }} />

      <div className="relative h-full pl-[0.75em] pr-[0.5em] py-[0.375em] flex flex-col">
        <div className="flex items-center gap-[0.375em] min-w-0">
          <span
            className="inline-flex items-center gap-[0.25em] px-[0.25em] py-px rounded text-[0.5625em] font-mono shrink-0"
            style={{ color: style.text, background: 'color-mix(in srgb, var(--c-canvas) 55%, transparent)', border: `1px solid ${style.border}` }}
          >
            <Icon size="0.9em" />
            {type?.name ?? 'No type'}
          </span>
          <div className="flex-1" />
          {inCount > 0 && (
            <span title={`Waits on ${inCount}`} className="inline-flex items-center gap-[0.125em] text-[0.5625em] font-mono text-[color:var(--c-text-muted)]">
              <ArrowDownToLine size="0.9em" />{inCount}
            </span>
          )}
          {outCount > 0 && (
            <span title={`Needed by ${outCount}`} className="inline-flex items-center gap-[0.125em] text-[0.5625em] font-mono text-[color:var(--c-text-muted)]">
              <ArrowUpFromLine size="0.9em" />{outCount}
            </span>
          )}
        </div>

        <div className="mt-[0.25em] text-[0.75em] font-semibold text-[color:var(--c-text)] leading-[1.25]">{card.title}</div>

        <div className="flex-1" />
        <div className="flex items-center gap-[0.375em] min-w-0 text-[0.625em] text-[color:var(--c-text-muted)] font-mono leading-none">
          {external && card.party && <span className="truncate text-[color:var(--c-text-soft)] max-w-[9.6em]">{card.party}</span>}
          {ownerName && <span className="truncate max-w-[8em]">{ownerName}</span>}
          {card.estimate !== undefined && (
            <span className="shrink-0 px-[0.25em] py-px rounded bg-[var(--c-subtle)] text-[color:var(--c-text-soft)]">{card.estimate}</span>
          )}
          <div className="flex-1" />
          {hasDesc && <AlignLeft size="0.9em" className="shrink-0 text-[color:var(--c-text-faint)]" aria-label="Has description" />}
          {card.hasContent && <BookOpen size="0.9em" className="shrink-0 text-[color:var(--c-text-muted)]" aria-label="Has document" />}
          {hasAttachments && <Paperclip size="0.9em" className="shrink-0 text-[color:var(--c-text-faint)]" aria-label="Has attachments" />}
        </div>
      </div>
    </div>
    </div>
  )
})

Card.displayName = 'Card'
