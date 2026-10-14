import type { BoardConfig, Card, Dependency } from '../types'
import { EXTERNAL_LANE_ID } from '../types'
import { CARD_W, HEADER_H, SLOT_W, SLOTS } from './constants'
import { checkSchedule } from './dependencies'
import { computeLayout } from './layout'
import { pickSides, type Side } from './edgeRoute'
import { slotIndex, slotOf } from './slots'
import { edgeAppearance } from '../lib/edgeStyle'

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Escape user text for use inside an HTML label. The whole label is XML-escaped again when it goes into an attribute. */
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Blend `hex` over `base` at the given alpha, as #rrggbb. Used for the card tint. */
function blend(base: string, hex: string, alpha: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const mix = (i: number) => Math.round(p(base, i) * (1 - alpha) + p(hex, i) * alpha)
  return '#' + [0, 1, 2].map((i) => mix(i).toString(16).padStart(2, '0')).join('')
}

const fmtDate = (iso?: string) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''

/**
 * Exports the board as a draw.io (diagrams.net) file that looks like the board:
 * the same lanes, sprint columns, start/end divider, card positions, sizes and
 * type colours, with dependency arrows styled by state and schedule check.
 * Geometry comes straight from computeLayout, so the two can never drift apart.
 */
export function boardToDrawio(config: BoardConfig, cards: Card[], dependencies: Dependency[], heightOf?: (card: Card) => number, labelW?: number): string {
  const layout = computeLayout(config, cards, heightOf, labelW)
  const cells: string[] = []
  let n = 2
  const nextId = () => `n${n++}`

  const vertex = (value: string, style: string, x: number, y: number, w: number, h: number, id = nextId()) => {
    cells.push(
      `<mxCell id="${id}" value="${xml(value)}" style="${xml(style)}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`,
    )
    return id
  }

  const typeById = new Map(config.cardTypes.map((t) => [t.id, t]))
  const teamName = new Map(config.teams.map((t) => [t.id, t.name]))
  const teamColour = new Map(config.teams.map((t) => [t.id, t.colour]))
  const text = '#e6edf3'

  // Lane rows, alternating like the board; the external row is dashed
  layout.rows.forEach((row, i) => {
    const external = row.laneId === EXTERNAL_LANE_ID
    vertex(
      '',
      `rounded=0;whiteSpace=wrap;html=1;fillColor=${external ? '#10161f' : i % 2 === 0 ? '#0d1117' : '#0f141b'};strokeColor=${external ? '#3d444d' : '#30363d'};${external ? 'dashed=1;' : ''}`,
      0, row.y, layout.width, row.h,
    )
  })

  // Faint start / end divider inside each sprint column
  const lastTop = layout.rows[layout.rows.length - 1]
  layout.cols.forEach((col) => {
    SLOTS.slice(1).forEach((slot) => {
      vertex('', 'rounded=0;html=1;fillColor=#1d242d;strokeColor=none;', col.x + slotIndex(slot) * SLOT_W, HEADER_H, 1, lastTop.y + lastTop.h - HEADER_H)
    })
  })

  // Sprint headers
  const sprints = new Map(config.sprints.map((s) => [s.id, s]))
  layout.cols.forEach((col) => {
    const sp = sprints.get(col.sprintId)
    if (!sp) return
    const dates = sp.start ? `${fmtDate(sp.start)}${sp.end ? ` – ${fmtDate(sp.end)}` : ''}` : ''
    const label = `<b>${html(sp.name)}</b>${sp.isInnovation ? ' <font color="#3fb950">[IP]</font>' : ''}${dates ? `<br><font color="#8b949e" style="font-size:10px">${html(dates)}</font>` : ''}`
    vertex(label, `rounded=0;whiteSpace=wrap;html=1;fillColor=#161b22;strokeColor=#30363d;fontColor=${text};fontSize=12;align=left;spacingLeft=12;`, col.x, 0, col.w, HEADER_H)
  })

  // Corner (PI name) and team labels
  vertex(
    `<font color="#8b949e" style="font-size:9px">PROGRAMME INCREMENT</font><br><b>${html(config.pi.name)}</b>`,
    `rounded=0;whiteSpace=wrap;html=1;fillColor=#161b22;strokeColor=#30363d;fontColor=${text};fontSize=12;align=left;spacingLeft=12;`,
    0, 0, layout.labelW, HEADER_H,
  )
  layout.rows.forEach((row) => {
    const external = row.laneId === EXTERNAL_LANE_ID
    const name = external ? config.externalLane.label : teamName.get(row.laneId) ?? ''
    vertex(
      `<b>${html(name)}</b>`,
      `rounded=0;whiteSpace=wrap;html=1;fillColor=${external ? '#131a24' : '#161b22'};strokeColor=${external ? '#3d444d' : '#30363d'};${external ? 'dashed=1;' : ''}fontColor=${text};fontSize=12;align=left;verticalAlign=top;spacingLeft=14;spacingTop=8;`,
      0, row.y, layout.labelW, row.h,
    )
    if (!external) vertex('', `rounded=0;html=1;fillColor=${teamColour.get(row.laneId) ?? '#58a6ff'};strokeColor=none;`, 0, row.y, 4, row.h)
  })

  // Cards, at exactly the positions the board draws them
  const ids = new Map<string, string>()
  cards.forEach((card) => {
    const pos = layout.cardPos[card.id]
    if (!pos) return
    const h = layout.cardH[card.id]
    const type = typeById.get(card.typeId)
    const colour = type?.colour ?? '#8b949e'
    const external = card.laneId === EXTERNAL_LANE_ID
    const meta = [
      type?.name,
      slotOf(card) === 'end' ? 'end of sprint' : undefined,
      card.owner ? teamName.get(card.owner) : undefined,
      card.party,
      card.estimate !== undefined ? `${card.estimate} pts` : undefined,
    ].filter(Boolean) as string[]
    const label = `<b>${html(card.title)}</b>${meta.length ? `<br><font color="#8b949e" style="font-size:10px">${html(meta.join(' · '))}</font>` : ''}`
    const id = vertex(
      label,
      `rounded=0;whiteSpace=wrap;html=1;fillColor=${blend('#161b22', colour, 0.14)};strokeColor=${colour};${external ? 'dashed=1;' : ''}fontColor=${text};fontSize=12;align=left;verticalAlign=top;spacingLeft=12;spacingTop=4;spacingRight=6;overflow=hidden;`,
      pos.x, pos.y, CARD_W, h,
    )
    ids.set(card.id, id)
    vertex('', `rounded=0;html=1;fillColor=${colour};strokeColor=none;`, pos.x, pos.y, 3, h)
  })

  // Dependencies join top and bottom where cards sit above or below each other, sides otherwise
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]))
  for (const dep of dependencies) {
    const source = ids.get(dep.from)
    const target = ids.get(dep.to)
    if (!source || !target) continue
    const check = checkSchedule(dep, byId, config.sprints)
    const { colour, width, dash } = edgeAppearance(dep.state, check)
    const label = [check === 'conflict' ? 'conflict' : check === 'same-sprint' ? 'same sprint' : undefined, dep.label].filter(Boolean).join(' · ')
    const fp = layout.cardPos[dep.from]
    const tp = layout.cardPos[dep.to]
    const sides = pickSides({ x: fp.x, y: fp.y, h: layout.cardH[dep.from] }, { x: tp.x, y: tp.y, h: layout.cardH[dep.to] })
    const anchor = (side: Side, kind: 'exit' | 'entry') => {
      const [x, y] = { top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5] }[side]
      return `${kind}X=${x};${kind}Y=${y};`
    }
    const style =
      `html=1;${anchor(sides.source, 'exit')}${anchor(sides.target, 'entry')}` +
      `endArrow=block;endFill=1;strokeColor=${colour};strokeWidth=${width};${dash ? 'dashed=1;' : ''}` +
      `fontColor=${check === 'conflict' ? '#f85149' : text};labelBackgroundColor=#161b22;fontSize=10;`
    cells.push(
      `<mxCell id="${nextId()}" value="${xml(html(label))}" style="${xml(style)}" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    )
  }

  return (
    `<mxfile host="PI Board">` +
    `<diagram name="${xml(config.pi.name)}" id="piboard">` +
    `<mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" background="#0d1117" math="0" shadow="0">` +
    `<root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root>` +
    `</mxGraphModel></diagram></mxfile>\n`
  )
}
