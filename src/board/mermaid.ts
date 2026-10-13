import type { BoardConfig, Card, Dependency } from '../types'
import { EXTERNAL_LANE_ID } from '../types'
import { SLOTS } from './constants'
import { checkSchedule } from './dependencies'
import { slotIndex, slotOf } from './slots'

/** Mermaid text is quoted; keep quotes, angle brackets and newlines from breaking it. */
function esc(text: string): string {
  return text.replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;').replace(/\r?\n/g, ' ')
}

/**
 * Renders the board as a Mermaid flowchart that draw.io can import
 * (Arrange > Insert > Advanced > Mermaid). Sprints become columns (left to right),
 * teams become groups inside each sprint, and the external lane is its own group.
 * Dependency state sets the line style, and schedule conflicts are drawn red.
 */
export function boardToMermaid(config: BoardConfig, cards: Card[], dependencies: Dependency[], title?: string): string {
  const out: string[] = []
  const id = new Map<string, string>(cards.map((c, i) => [c.id, `c${i + 1}`]))
  const typeIndex = new Map(config.cardTypes.map((t, i) => [t.id, i]))
  const typeById = new Map(config.cardTypes.map((t) => [t.id, t]))
  const teamName = new Map(config.teams.map((t) => [t.id, t.name]))
  const lanes = [...config.teams.map((t) => ({ id: t.id, name: t.name })), { id: EXTERNAL_LANE_ID, name: config.externalLane.label }]

  if (title) out.push('---', `title: "${esc(title)}"`, '---')
  out.push('flowchart LR')

  config.sprints.forEach((sprint, si) => {
    const inSprint = cards.filter((c) => c.sprintId === sprint.id)
    if (inSprint.length === 0) return
    const dates = sprint.start ? ` (${sprint.start}${sprint.end ? ` to ${sprint.end}` : ''})` : ''
    out.push(`  subgraph S${si}["${esc(sprint.name)}${sprint.isInnovation ? ' [IP]' : ''}${esc(dates)}"]`)
    out.push('    direction TB')
    for (const lane of lanes) {
      const inLane = inSprint
        .filter((c) => c.laneId === lane.id)
        .sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot) || a.order - b.order)
      if (inLane.length === 0) continue
      out.push(`    subgraph S${si}_${lane.id.replace(/[^A-Za-z0-9_]/g, '_')}["${esc(lane.name)}"]`)
      out.push('      direction TB')
      for (const c of inLane) {
        const type = typeById.get(c.typeId)
        const lines = [`<b>${esc(c.title)}</b>`]
        const meta = [
          type?.name,
          slotOf(c) === SLOTS[SLOTS.length - 1] ? 'end of sprint' : undefined,
          c.owner ? teamName.get(c.owner) : undefined,
          c.party,
          c.estimate !== undefined ? `${c.estimate} pts` : undefined,
        ].filter(Boolean)
        if (meta.length) lines.push(esc(meta.join(' · ')))
        out.push(`      ${id.get(c.id)}["${lines.join('<br/>')}"]`)
      }
      out.push('    end')
    }
    out.push('  end')
  })

  // Dependencies: `from` is delivered first, the arrow points at `to`
  const conflictIdx: number[] = []
  let edgeNo = 0
  for (const d of dependencies) {
    const a = id.get(d.from)
    const b = id.get(d.to)
    if (!a || !b) continue
    const arrow = d.state === 'proposed' ? '-.->' : d.state === 'at-risk' ? '==>' : '-->'
    const label = [d.label, d.state === 'at-risk' ? 'at risk' : undefined].filter(Boolean).join(' · ')
    out.push(label ? `  ${a} ${arrow}|"${esc(label)}"| ${b}` : `  ${a} ${arrow} ${b}`)
    if (checkSchedule(d, cards, config.sprints) === 'conflict') conflictIdx.push(edgeNo)
    edgeNo++
  }
  if (conflictIdx.length) out.push(`  linkStyle ${conflictIdx.join(',')} stroke:#f85149,stroke-width:3px`)

  // Colour by type
  config.cardTypes.forEach((t, i) => {
    const members = cards.filter((c) => typeIndex.get(c.typeId) === i).map((c) => id.get(c.id))
    out.push(`  classDef type${i} fill:${t.colour}33,stroke:${t.colour},color:#111111`)
    if (members.length) out.push(`  class ${members.join(',')} type${i}`)
  })

  return out.join('\n') + '\n'
}
