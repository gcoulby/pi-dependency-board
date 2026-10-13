import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from '@xyflow/react'
import type { DependencyState, ScheduleCheck } from '../../types'
import { useViewStore } from '../../store/viewStore'
import { edgeAppearance } from '../../lib/edgeStyle'

export interface DependencyEdgeData extends Record<string, unknown> {
  depId: string
  label?: string
  state: DependencyState
  check: ScheduleCheck
  dimmed: boolean
}

export const DependencyEdge = memo(function DependencyEdge({
  id, sourceX, sourceY, targetX, targetY, data, selected, markerEnd,
}: EdgeProps) {
  const d = data as DependencyEdgeData
  const { colour, width, dash } = edgeAppearance(d.state, d.check)
  // Straight lines, no bends: easier to trace by eye
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  const tags: { text: string; tone: 'danger' | 'warn' | 'plain' }[] = []
  if (d.check === 'conflict') tags.push({ text: 'conflict', tone: 'danger' })
  if (d.check === 'same-sprint') tags.push({ text: 'same sprint', tone: 'warn' })
  if (d.label) tags.push({ text: d.label, tone: 'plain' })

  return (
    <>
      {selected && (
        <path d={path} fill="none" stroke="#fbbf24" strokeWidth={width + 5} strokeOpacity={0.3} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
      )}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={16}
        style={{
          stroke: colour,
          strokeWidth: width,
          strokeDasharray: dash,
          opacity: d.dimmed ? 0.12 : 1,
        }}
      />
      {tags.length > 0 && !d.dimmed && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute pointer-events-auto nodrag nopan flex gap-1"
          >
            {tags.map((t) => (
              <button
                key={t.text}
                onClick={() => useViewStore.getState().openDependency(d.depId)}
                className={[
                  'px-1.5 py-px rounded border text-[10px] bg-[#161b22] max-w-[140px] truncate',
                  t.tone === 'danger'
                    ? 'border-[#f85149]/60 text-[#f85149]'
                    : t.tone === 'warn'
                      ? 'border-[#f0883e]/60 text-[#f0883e]'
                      : 'border-[#30363d] text-[#e6edf3]',
                ].join(' ')}
              >
                {t.text}
              </button>
            ))}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
