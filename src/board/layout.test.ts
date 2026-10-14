import { describe, expect, it } from 'vitest'
import type { BoardConfig, Card } from '../types'
import { EXTERNAL_LANE_ID } from '../types'
import { CARD_GAP, CARD_H, CELL_PAD, COL_W, SLOT_W, EXTERNAL_GAP, HEADER_H, LABEL_COL_W, MIN_ROW_H, labelColWidth } from './constants'
import { cellAt, computeLayout, insertIndexAt, stackHeight } from './layout'

const config: BoardConfig = {
  pi: { name: 'PI' },
  teams: [
    { id: 't1', name: 'One', colour: '#58a6ff' },
    { id: 't2', name: 'Two', colour: '#a78bfa' },
  ],
  sprints: [
    { id: 's1', name: 'S1' },
    { id: 's2', name: 'S2' },
    { id: 's3', name: 'IP', isInnovation: true },
  ],
  cardTypes: [{ id: 'feature', name: 'Feature', colour: '#58a6ff', icon: 'Layers' }],
  externalLane: { label: 'External' },
}

let n = 0
function card(laneId: string, sprintId: string, order: number, id = `c${++n}`): Card {
  return {
    id, title: id, typeId: 'feature', laneId, sprintId, order,
    tags: [], properties: {}, hasContent: false,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('computeLayout', () => {
  it('gives empty rows the minimum height and stacks rows under the header', () => {
    const l = computeLayout(config, [])
    expect(l.rows.map((r) => r.laneId)).toEqual(['t1', 't2', EXTERNAL_LANE_ID])
    expect(l.rows[0]).toEqual({ laneId: 't1', y: HEADER_H, h: MIN_ROW_H })
    expect(l.rows[1].y).toBe(HEADER_H + MIN_ROW_H)
    expect(l.cardPos).toEqual({})
  })

  it('lays columns out after the label column at fixed width', () => {
    const l = computeLayout(config, [])
    expect(l.cols.map((c) => c.x)).toEqual([LABEL_COL_W, LABEL_COL_W + COL_W, LABEL_COL_W + 2 * COL_W])
    expect(COL_W).toBe(2 * SLOT_W)
    expect(l.width).toBe(LABEL_COL_W + 3 * COL_W)
  })

  it('places a card inside its cell with padding', () => {
    const c = card('t2', 's2', 0, 'x')
    const l = computeLayout(config, [c])
    expect(l.cardPos.x).toEqual({ x: l.cols[1].x + CELL_PAD, y: l.rows[1].y + CELL_PAD }) // default slot is start
  })

  it('stacks cards by order, not array position', () => {
    const a = card('t1', 's1', 1, 'a')
    const b = card('t1', 's1', 0, 'b')
    const l = computeLayout(config, [a, b])
    expect(l.cardPos.b.y).toBeLessThan(l.cardPos.a.y)
    expect(l.cardPos.a.y - l.cardPos.b.y).toBe(CARD_H + CARD_GAP)
  })

  it('grows a row to fit its tallest cell, and only that row', () => {
    const cards = Array.from({ length: 12 }, (_, i) => card('t1', 's2', i))
    const l = computeLayout(config, cards)
    expect(l.rows[0].h).toBe(stackHeight(12))
    expect(l.rows[0].h).toBeGreaterThan(MIN_ROW_H)
    expect(l.rows[1].h).toBe(MIN_ROW_H)
    expect(l.rows[1].y).toBe(HEADER_H + stackHeight(12))
  })

  it('keeps the minimum height for a lightly filled row', () => {
    const l = computeLayout(config, [card('t1', 's1', 0)])
    expect(l.rows[0].h).toBe(MIN_ROW_H)
  })

  it('offsets the external row by the gap and keeps it last', () => {
    const l = computeLayout(config, [card(EXTERNAL_LANE_ID, 's1', 0, 'e')])
    const last = l.rows[l.rows.length - 1]
    const prev = l.rows[l.rows.length - 2]
    expect(last.laneId).toBe(EXTERNAL_LANE_ID)
    expect(last.y).toBe(prev.y + prev.h + EXTERNAL_GAP)
    expect(l.cardPos.e.y).toBe(last.y + CELL_PAD)
    expect(l.height).toBe(last.y + last.h)
  })
})

describe('cellAt', () => {
  const l = computeLayout(config, [])

  it('finds the cell under a point', () => {
    expect(cellAt(l, l.cols[1].x + 5, l.rows[1].y + 5)).toEqual({ laneId: 't2', sprintId: 's2', slot: 'start' })
  })

  it('treats left edges as inside and right/bottom edges as outside', () => {
    expect(cellAt(l, l.cols[0].x, l.rows[0].y)).toEqual({ laneId: 't1', sprintId: 's1', slot: 'start' })
    expect(cellAt(l, l.cols[0].x + COL_W, l.rows[0].y)).toEqual({ laneId: 't1', sprintId: 's2', slot: 'start' })
    expect(cellAt(l, l.cols[0].x, l.rows[0].y + l.rows[0].h)).toEqual({ laneId: 't2', sprintId: 's1', slot: 'start' })
  })

  it('returns null over headers, the label column and past the edges', () => {
    expect(cellAt(l, l.cols[0].x + 5, HEADER_H - 1)).toBeNull()
    expect(cellAt(l, LABEL_COL_W - 1, HEADER_H + 5)).toBeNull()
    expect(cellAt(l, l.width, HEADER_H + 5)).toBeNull()
    expect(cellAt(l, l.cols[0].x + 5, l.height)).toBeNull()
  })

  it('returns null in the gap above the external row and finds the external row', () => {
    const t2 = l.rows[1]
    const ext = l.rows[2]
    expect(cellAt(l, l.cols[0].x + 5, t2.y + t2.h + 1)).toBeNull()
    expect(cellAt(l, l.cols[0].x + 5, ext.y + 1)).toEqual({ laneId: EXTERNAL_LANE_ID, sprintId: 's1', slot: 'start' })
  })
})

describe('insertIndexAt', () => {
  const cell = { laneId: 't1', sprintId: 's1', slot: 'start' as const }
  const cards = [card('t1', 's1', 0, 'a'), card('t1', 's1', 1, 'b'), card('t1', 's1', 2, 'c')]
  const l = computeLayout(config, cards)
  const top = (i: number) => l.rows[0].y + CELL_PAD + i * (CARD_H + CARD_GAP)

  it('is 0 for an empty cell', () => {
    expect(insertIndexAt(l, [], cell, l.rows[0].y + 30)).toBe(0)
  })

  it('inserts before the first card when dropped above its midpoint', () => {
    expect(insertIndexAt(l, cards, cell, top(0) + 5)).toBe(0)
  })

  it('inserts between cards around midpoints', () => {
    expect(insertIndexAt(l, cards, cell, top(0) + CARD_H / 2 + 1)).toBe(1)
    expect(insertIndexAt(l, cards, cell, top(1) + CARD_H / 2 - 1)).toBe(1)
    expect(insertIndexAt(l, cards, cell, top(1) + CARD_H / 2 + 1)).toBe(2)
  })

  it('appends when dropped below the last card', () => {
    expect(insertIndexAt(l, cards, cell, top(2) + CARD_H + 20)).toBe(3)
  })
})

describe('label column width', () => {
  it('moves the sprint columns right when the label column is wider', () => {
    const narrow = computeLayout(config, [])
    const wide = computeLayout(config, [], undefined, 260)
    expect(wide.labelW).toBe(260)
    expect(wide.cols[0].x).toBe(260)
    expect(wide.width - narrow.width).toBe(260 - LABEL_COL_W)
  })
  it('only widens above the default text size', () => {
    expect(labelColWidth(0.85)).toBe(LABEL_COL_W)
    expect(labelColWidth(1)).toBe(LABEL_COL_W)
    expect(labelColWidth(2)).toBeGreaterThan(LABEL_COL_W)
  })
})

describe('sprint slots', () => {
  const at = (slot: 'start' | 'end', id: string): Card => ({ ...card('t1', 's1', 0, id), slot })

  it('places start and end cards in two sub-columns of one sprint', () => {
    const l = computeLayout(config, [at('start', 'a'), at('end', 'b')])
    const base = l.cols[0].x + CELL_PAD
    expect(l.cardPos.a.x).toBe(base)
    expect(l.cardPos.b.x).toBe(base + SLOT_W)
    // Different sub-columns do not stack on one another
    expect(l.cardPos.a.y).toBe(l.cardPos.b.y)
  })

  it('stacks cards only within the same slot', () => {
    const l = computeLayout(config, [at('end', 'a'), { ...at('end', 'b'), order: 1 }, at('start', 'c')])
    expect(l.cardPos.b.y).toBeGreaterThan(l.cardPos.a.y)
    expect(l.cardPos.c.y).toBe(l.cardPos.a.y)
  })

  it('cellAt resolves the slot from x', () => {
    const l = computeLayout(config, [])
    const y = l.rows[0].y + 5
    const x0 = l.cols[1].x
    expect(cellAt(l, x0 + 1, y)).toEqual({ laneId: 't1', sprintId: 's2', slot: 'start' })
    expect(cellAt(l, x0 + SLOT_W - 1, y)?.slot).toBe('start')
    expect(cellAt(l, x0 + SLOT_W, y)?.slot).toBe('end')
    expect(cellAt(l, x0 + COL_W - 1, y)?.slot).toBe('end')
    expect(cellAt(l, x0 + COL_W, y)).toEqual({ laneId: 't1', sprintId: 's3', slot: 'start' })
  })
})
