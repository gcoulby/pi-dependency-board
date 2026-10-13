import type { BoardConfig, Card, CardId, LaneId, SprintId, SprintSlot } from '../types'
import { EXTERNAL_LANE_ID } from '../types'
import {
  CARD_GAP,
  CARD_H,
  CELL_PAD,
  COL_W,
  EXTERNAL_GAP,
  HEADER_H,
  LABEL_COL_W,
  MIN_ROW_H,
  SLOT_W,
  SLOTS,
  cardHeight,
} from './constants'
import { slotIndex, slotOf } from './slots'

export interface BoardLayout {
  cols: { sprintId: SprintId; x: number; w: number }[]
  rows: { laneId: LaneId; y: number; h: number }[]
  cardPos: Record<CardId, { x: number; y: number }>
  /** Height of each card. Cards are resized per ticket; width is always CARD_W. */
  cardH: Record<CardId, number>
  width: number
  height: number
}

export interface Cell {
  laneId: LaneId
  sprintId: SprintId
  /** Start or end of the sprint: two sub-columns per sprint. */
  slot: SprintSlot
}

const byOrder = (a: Card, b: Card) =>
  a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

/** Cards of one cell, sorted by `order` (ties broken by creation time, then id). */
export function cardsInCell(cards: Card[], cell: Cell): Card[] {
  return cards
    .filter((c) => c.laneId === cell.laneId && c.sprintId === cell.sprintId && slotOf(c) === cell.slot)
    .sort(byOrder)
}

/** Height of a cell holding cards of the given heights, padding included. */
export function stackHeightOf(heights: number[]): number {
  if (heights.length === 0) return 0
  return heights.reduce((sum, h) => sum + h, 0) + (heights.length - 1) * CARD_GAP + 2 * CELL_PAD
}

/** Height of a cell holding `n` cards of one height (medium by default). */
export function stackHeight(n: number, cardH: number = CARD_H): number {
  return stackHeightOf(Array.from({ length: n }, () => cardH))
}

/**
 * Pure geometry. Positions are never stored: every render derives them from
 * which cell each card sits in, plus its `order` within that cell, plus its size.
 * Coordinates are relative to the top-left of the sprint-header strip.
 */
export function computeLayout(config: BoardConfig, cards: Card[]): BoardLayout {
  const cols = config.sprints.map((s, i) => ({
    sprintId: s.id,
    x: LABEL_COL_W + i * COL_W,
    w: COL_W,
  }))

  const laneIds: LaneId[] = [...config.teams.map((t) => t.id), EXTERNAL_LANE_ID]

  // Group once: lane -> sprint -> sorted cards
  const grouped = new Map<string, Card[]>()
  for (const c of cards) {
    const key = `${c.laneId}\u0000${c.sprintId}\u0000${slotOf(c)}`
    const list = grouped.get(key)
    if (list) list.push(c)
    else grouped.set(key, [c])
  }
  for (const list of grouped.values()) list.sort(byOrder)

  const rows: BoardLayout['rows'] = []
  const cardPos: BoardLayout['cardPos'] = {}
  const cardH: BoardLayout['cardH'] = {}
  let y = HEADER_H

  for (const laneId of laneIds) {
    if (laneId === EXTERNAL_LANE_ID) y += EXTERNAL_GAP

    let tallest = 0
    for (const col of cols) {
      for (const slot of SLOTS) {
        const list = grouped.get(`${laneId}\u0000${col.sprintId}\u0000${slot}`)
        if (!list) continue
        const x = col.x + slotIndex(slot) * SLOT_W + CELL_PAD
        let top = y + CELL_PAD
        for (const c of list) {
          const h = cardHeight(c.size)
          cardPos[c.id] = { x, y: top }
          cardH[c.id] = h
          top += h + CARD_GAP
        }
        tallest = Math.max(tallest, stackHeightOf(list.map((c) => cardHeight(c.size))))
      }
    }

    const h = Math.max(MIN_ROW_H, tallest)
    rows.push({ laneId, y, h })
    y += h
  }

  return { cols, rows, cardPos, cardH, width: LABEL_COL_W + cols.length * COL_W, height: y }
}

/** The (lane, sprint, slot) cell under a point, or null for headers, label column, gaps and outside. */
export function cellAt(layout: BoardLayout, x: number, y: number): Cell | null {
  const col = layout.cols.find((c) => x >= c.x && x < c.x + c.w)
  if (!col) return null
  const row = layout.rows.find((r) => y >= r.y && y < r.y + r.h)
  if (!row) return null
  const slot = SLOTS[Math.min(SLOTS.length - 1, Math.floor((x - col.x) / SLOT_W))]
  return { laneId: row.laneId, sprintId: col.sprintId, slot }
}

/**
 * Insert slot (0..n) among the cards currently shown in a cell, for a drop at
 * flow-y: the number of cards whose vertical midpoint lies above `y`. Pass every
 * card (the layout still shows a dragged card in its old slot). When the dragged
 * card is already in this cell and the slot is below it, subtract one before
 * calling `moveCard`, which removes the card first.
 */
export function insertIndexAt(layout: BoardLayout, cards: Card[], cell: Cell, y: number): number {
  const stack = cardsInCell(cards, cell)
  for (let i = 0; i < stack.length; i++) {
    const pos = layout.cardPos[stack[i].id]
    const h = layout.cardH[stack[i].id] ?? CARD_H
    if (pos && y < pos.y + h / 2) return i
  }
  return stack.length
}
