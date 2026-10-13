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
  const size = card.size ?? 'm'
  const external = card.laneId === EXTERNAL_LANE_ID
  const hasDesc = Boolean(card.description?.trim())
  const hasAttachments = (card.attachments?.length ?? 0) > 0

  return (
    <div className="relative w-full h-full transition-opacity duration-150 select-none" style={{ opacity: dimmed ? 0.22 : 1 }}>
      {/* Handles sit outside the clipped box, or their outer half is unreachable */}
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    <div
      className="relative w-full h-full rounded overflow-hidden bg-[#161b22]"
      style={{
        border: `1px ${external ? 'dashed' : 'solid'} ${selected ? '#fbbf24' : style.border}`,
        boxShadow: selected ? '0 0 0 2px rgba(251,191,36,0.2)' : undefined,
      }}
    >

      <div className="absolute inset-0" style={{ background: style.bg }} />
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: style.bar }} />

      <div className="relative h-full pl-3 pr-2 py-1.5 flex flex-col">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-flex items-center gap-1 px-1 py-px rounded text-[9px] font-mono shrink-0"
            style={{ color: style.text, background: '#0d111788', border: `1px solid ${style.border}` }}
          >
            <Icon size={9} />
            {type?.name ?? 'No type'}
          </span>
          <div className="flex-1" />
          {inCount > 0 && (
            <span title={`Waits on ${inCount}`} className="inline-flex items-center gap-0.5 text-[9px] font-mono text-[#8b949e]">
              <ArrowDownToLine size={9} />{inCount}
            </span>
          )}
          {outCount > 0 && (
            <span title={`Needed by ${outCount}`} className="inline-flex items-center gap-0.5 text-[9px] font-mono text-[#8b949e]">
              <ArrowUpFromLine size={9} />{outCount}
            </span>
          )}
        </div>

        <div className={`mt-1 text-[12px] font-semibold text-[#e6edf3] leading-[15px] ${size === 's' ? 'line-clamp-1' : size === 'l' ? 'line-clamp-3 text-[13px] leading-[17px]' : 'line-clamp-2'}`}>{card.title}</div>

        <div className="flex-1" />
        <div className={`flex items-center gap-1.5 min-w-0 text-[10px] text-[#8b949e] font-mono leading-none ${size === 's' ? 'hidden' : ''}`}>
          {external && card.party && <span className="truncate text-[#c9d1d9] max-w-[96px]">{card.party}</span>}
          {ownerName && <span className="truncate max-w-[80px]">{ownerName}</span>}
          {card.estimate !== undefined && (
            <span className="shrink-0 px-1 py-px rounded bg-[#21262d] text-[#c9d1d9]">{card.estimate}</span>
          )}
          <div className="flex-1" />
          {hasDesc && <AlignLeft size={9} className="shrink-0 text-[#484f58]" aria-label="Has description" />}
          {card.hasContent && <BookOpen size={9} className="shrink-0 text-[#8b949e]" aria-label="Has document" />}
          {hasAttachments && <Paperclip size={9} className="shrink-0 text-[#484f58]" aria-label="Has attachments" />}
        </div>
      </div>
    </div>
    </div>
  )
})

Card.displayName = 'Card'
