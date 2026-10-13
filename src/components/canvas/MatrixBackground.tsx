import { memo, useEffect, useRef, useState } from 'react'
import { ViewportPortal, useViewport } from '@xyflow/react'
import { ExternalLink, Plus } from 'lucide-react'
import type { BoardConfig, LaneId, SprintId } from '../../types'
import { EXTERNAL_LANE_ID } from '../../types'
import type { BoardLayout, Cell } from '../../board/layout'
import { EXTERNAL_GAP, HEADER_H, LABEL_COL_W, SLOT_W, SLOTS } from '../../board/constants'
import { slotIndex } from '../../board/slots'
import { useBoardStore } from '../../store/boardStore'

// ── In-flow layer: lanes, column rules, drop highlight ───────────────────────
// Rendered in the viewport portal so it pans and zooms with the cards. Plain
// divs: nothing here is selectable, draggable or focusable.

interface MatrixProps {
  layout: BoardLayout
  hoverCell: Cell | null
  /** Lane ids dimmed by the team filter. */
  dimLane: LaneId | null
}

export const MatrixBackground = memo(function MatrixBackground({ layout, hoverCell, dimLane }: MatrixProps) {
  const hoverCol = hoverCell ? layout.cols.find((c) => c.sprintId === hoverCell.sprintId) : null
  const hoverRow = hoverCell ? layout.rows.find((r) => r.laneId === hoverCell.laneId) : null

  return (
    <ViewportPortal>
      <div style={{ position: 'absolute', left: 0, top: 0, width: layout.width, height: layout.height, pointerEvents: 'none' }} aria-hidden>
        {layout.rows.map((row, i) => {
          const external = row.laneId === EXTERNAL_LANE_ID
          return (
            <div
              key={row.laneId}
              style={{
                position: 'absolute',
                left: 0,
                top: row.y,
                width: layout.width,
                height: row.h,
                background: external ? '#10161f' : i % 2 === 0 ? '#0d1117' : '#0f141b',
                borderBottom: external ? '1px dashed #3d444d' : '1px solid #30363d',
                borderTop: external ? '1px dashed #3d444d' : i === 0 ? '1px solid #30363d' : undefined,
                opacity: dimLane && dimLane !== row.laneId ? 0.45 : 1,
              }}
            />
          )
        })}
        {layout.cols.map((col) => (
          <div
            key={col.sprintId}
            style={{ position: 'absolute', left: col.x, top: HEADER_H, width: 1, height: layout.height - HEADER_H, background: '#30363d' }}
          />
        ))}
        {layout.cols.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: layout.cols[layout.cols.length - 1].x + layout.cols[layout.cols.length - 1].w,
              top: HEADER_H,
              width: 1,
              height: layout.height - HEADER_H,
              background: '#30363d',
            }}
          />
        )}
        {/* The start / mid / end sub-columns are invisible, except as faint guides while a card is dragged */}
        {hoverCell && layout.cols.flatMap((col) =>
          SLOTS.slice(1).map((slot) => (
            <div
              key={`${col.sprintId}-${slot}`}
              style={{
                position: 'absolute',
                left: col.x + slotIndex(slot) * SLOT_W,
                top: HEADER_H,
                width: 0,
                height: layout.height - HEADER_H,
                borderLeft: '1px dashed #30363d',
              }}
            />
          )),
        )}
        {hoverCol && hoverRow && (
          <div
            style={{
              position: 'absolute',
              left: hoverCol.x + slotIndex(hoverCell!.slot) * SLOT_W,
              top: hoverRow.y,
              width: SLOT_W,
              height: hoverRow.h,
              background: 'rgba(251,191,36,0.07)',
              outline: '2px solid rgba(251,191,36,0.6)',
              outlineOffset: -2,
            }}
          />
        )}
      </div>
    </ViewportPortal>
  )
})

// ── Sticky headers ────────────────────────────────────────────────────────────
// Overlays above the flow. The sprint strip follows x and zoom but is pinned to
// the top; the team column follows y and zoom but is pinned to the left.

function InlineEdit({
  value, onCommit, onCancel, className,
}: { value: string; onCommit: (v: string) => void; onCancel: () => void; className?: string }) {
  const [text, setText] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.select() }, [])
  const commit = () => {
    if (text.trim()) onCommit(text.trim())
    else onCancel()
  }
  return (
    <input
      ref={ref}
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onCancel()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`bg-[#0d1117] border border-amber-400/60 rounded px-1.5 py-0.5 text-[#e6edf3] focus:outline-none min-w-0 w-full ${className ?? ''}`}
    />
  )
}

type Editing = { kind: 'sprint' | 'team' | 'external'; id: string } | null

interface HeaderProps {
  layout: BoardLayout
  config: BoardConfig
  dimLane: LaneId | null
}

/** Lays out `children` at its natural size, then scales the whole box with the viewport zoom. */
function Scaled({ w, h, zoom, children }: { w: number; h: number; zoom: number; children: React.ReactNode }) {
  return (
    <div style={{ width: w * zoom, height: h * zoom, overflow: 'hidden' }}>
      <div style={{ width: w, height: h, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
  )
}

export const StickyHeaders = memo(function StickyHeaders({ layout, config, dimLane }: HeaderProps) {
  const { x, y, zoom } = useViewport()
  const [editing, setEditing] = useState<Editing>(null)
  const { updateSprint, updateTeam, setExternalLabel, addSprint, addTeam } = useBoardStore.getState()

  const lastTeamRow = layout.rows.length >= 2 ? layout.rows[layout.rows.length - 2] : null
  const lastCol = layout.cols[layout.cols.length - 1]
  const teamsById = new Map(config.teams.map((t) => [t.id, t]))
  const sprintsById = new Map<SprintId, (typeof config.sprints)[number]>(config.sprints.map((s) => [s.id, s]))

  const fmt = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '')

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'hidden' }}>
      {/* Sprint strip: follows x and zoom, pinned to the top */}
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: HEADER_H * zoom, background: '#161b22', borderBottom: '1px solid #30363d' }}>
        {layout.cols.map((col) => {
          const sp = sprintsById.get(col.sprintId)
          if (!sp) return null
          const isEditing = editing?.kind === 'sprint' && editing.id === sp.id
          const dates = sp.start ? `${fmt(sp.start)}${sp.end ? ` – ${fmt(sp.end)}` : ''}` : ''
          return (
            <div
              key={sp.id}
              onDoubleClick={() => setEditing({ kind: 'sprint', id: sp.id })}
              title="Double-click to rename"
              style={{ position: 'absolute', left: x + col.x * zoom, top: 0, pointerEvents: 'auto', borderLeft: '1px solid #30363d' }}
            >
              <Scaled w={col.w} h={HEADER_H} zoom={zoom}>
                <div className="px-3 h-full flex flex-col justify-center overflow-hidden">
                  {isEditing ? (
                    <InlineEdit
                      value={sp.name}
                      className="text-[12px] font-semibold"
                      onCommit={(v) => { updateSprint(sp.id, { name: v }); setEditing(null) }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[12px] font-semibold text-[#e6edf3] truncate">{sp.name}</span>
                      {sp.isInnovation && (
                        <span className="shrink-0 text-[9px] font-mono px-1 py-px rounded border border-[#3fb950]/50 text-[#3fb950] bg-[#3fb950]/10">IP</span>
                      )}
                    </div>
                  )}
                  {dates && !isEditing && <div className="text-[10px] font-mono text-[#484f58] truncate">{dates}</div>}
                </div>
              </Scaled>
            </div>
          )
        })}
        {lastCol && (
          <div style={{ position: 'absolute', left: x + (lastCol.x + lastCol.w) * zoom + 8 * zoom, top: 0, pointerEvents: 'auto' }}>
            <Scaled w={100} h={HEADER_H} zoom={zoom}>
              <div className="h-full flex items-center">
                <button
                  onClick={() => addSprint()}
                  title="Add sprint"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#8b949e] hover:text-amber-400 hover:bg-[#1c2333] rounded border border-dashed border-[#30363d] whitespace-nowrap"
                >
                  <Plus size={11} /> Sprint
                </button>
              </div>
            </Scaled>
          </div>
        )}
      </div>

      {/* Team column: follows y and zoom, pinned to the left */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: LABEL_COL_W * zoom, background: '#161b22', borderRight: '1px solid #30363d' }}>
        {layout.rows.map((row) => {
          const external = row.laneId === EXTERNAL_LANE_ID
          const team = external ? null : teamsById.get(row.laneId)
          if (!external && !team) return null
          const isEditing = editing && (external ? editing.kind === 'external' : editing.kind === 'team' && editing.id === row.laneId)
          return (
            <div
              key={row.laneId}
              onDoubleClick={() => setEditing(external ? { kind: 'external', id: EXTERNAL_LANE_ID } : { kind: 'team', id: row.laneId })}
              title="Double-click to rename"
              style={{
                position: 'absolute', left: 0, top: y + row.y * zoom, pointerEvents: 'auto',
                borderTop: external ? '1px dashed #3d444d' : '1px solid #30363d',
                borderBottom: external ? '1px dashed #3d444d' : undefined,
                background: external ? '#131a24' : '#161b22',
                opacity: dimLane && dimLane !== row.laneId ? 0.45 : 1,
              }}
            >
              <Scaled w={LABEL_COL_W} h={row.h} zoom={zoom}>
                <div className="flex h-full overflow-hidden">
                  <div style={{ width: 3, background: external ? 'transparent' : team!.colour }} className="shrink-0" />
                  <div className="flex-1 min-w-0 px-3 pt-2.5">
                    {isEditing ? (
                      <InlineEdit
                        value={external ? config.externalLane.label : team!.name}
                        className="text-[12px] font-semibold"
                        onCommit={(v) => { if (external) setExternalLabel(v); else updateTeam(row.laneId, { name: v }); setEditing(null) }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <div className="flex items-start gap-1.5">
                        {external && <ExternalLink size={12} className="text-[#8b949e] mt-0.5 shrink-0" />}
                        <span className="text-[12px] font-semibold text-[#e6edf3] leading-tight break-words">
                          {external ? config.externalLane.label : team!.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Scaled>
            </div>
          )
        })}
        {lastTeamRow && (
          <div style={{ position: 'absolute', left: 0, top: y + (lastTeamRow.y + lastTeamRow.h) * zoom, pointerEvents: 'auto' }}>
            <Scaled w={LABEL_COL_W} h={EXTERNAL_GAP} zoom={zoom}>
              <div className="h-full flex items-center px-3.5">
                <button
                  onClick={() => addTeam()}
                  title="Add team"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#8b949e] hover:text-amber-400 hover:bg-[#1c2333] rounded border border-dashed border-[#30363d] whitespace-nowrap"
                >
                  <Plus size={11} /> Team
                </button>
              </div>
            </Scaled>
          </div>
        )}
      </div>

      {/* Corner */}
      <div style={{ position: 'absolute', left: 0, top: 0, background: '#161b22', borderRight: '1px solid #30363d', borderBottom: '1px solid #30363d' }}>
        <Scaled w={LABEL_COL_W} h={HEADER_H} zoom={zoom}>
          <div className="px-3 h-full flex flex-col justify-center overflow-hidden">
            <div className="text-[9px] uppercase tracking-wider text-[#484f58] font-mono">Programme increment</div>
            <div className="text-[12px] font-semibold text-[#e6edf3] truncate">{config.pi.name}</div>
          </div>
        </Scaled>
      </div>
    </div>
  )
})
