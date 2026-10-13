import { describe, expect, it } from 'vitest'
import type { BoardConfig, Card } from '../types'
import { EXTERNAL_LANE_ID } from '../types'
import { CARD_GAP, CARD_H, CARD_HEIGHTS, CELL_PAD, COL_W, EXTERNAL_GAP, HEADER_H, LABEL_COL_W, MIN_ROW_H } from './constants'
import { cellAt, computeLayout, insertIndexAt, stackHeight, stackHeightOf } from './layout'

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
    expect(l.width).toBe(LABEL_COL_W + 3 * COL_W)
  })

  it('places a card inside its cell with padding', () => {
    const c = card('t2', 's2', 0, 'x')
    const l = computeLayout(config, [c])
    expect(l.cardPos.x).toEqual({ x: l.cols[1].x + CELL_PAD, y: l.rows[1].y + CELL_PAD })
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

describe('per-card size', () => {
  const sized = (id: string, order: number, size?: 's' | 'm' | 'l'): Card => ({ ...card('t1', 's1', order, id), size })

  it('stacks cards by their own heights', () => {
    const cards = [sized('a', 0, 's'), sized('b', 1, 'l'), sized('c', 2)]
    const l = computeLayout(config, cards)
    expect(l.cardH).toEqual({ a: CARD_HEIGHTS.s, b: CARD_HEIGHTS.l, c: CARD_HEIGHTS.m })
    expect(l.cardPos.b.y - l.cardPos.a.y).toBe(CARD_HEIGHTS.s + CARD_GAP)
    expect(l.cardPos.c.y - l.cardPos.b.y).toBe(CARD_HEIGHTS.l + CARD_GAP)
  })

  it('sizes the row from the tallest cell', () => {
    const cards = [sized('a', 0, 'l'), sized('b', 1, 'l'), sized('c', 2, 'l')]
    const l = computeLayout(config, cards)
    expect(l.rows[0].h).toBe(stackHeightOf([CARD_HEIGHTS.l, CARD_HEIGHTS.l, CARD_HEIGHTS.l]))
  })

  it('keeps column width fixed whatever the sizes', () => {
    const l = computeLayout(config, [sized('a', 0, 'l')])
    expect(l.cols.every((c) => c.w === COL_W)).toBe(true)
  })

  it('inserts using the displayed heights', () => {
    const cards = [sized('a', 0, 'l'), sized('b', 1, 's')]
    const l = computeLayout(config, cards)
    const cell = { laneId: 't1', sprintId: 's1' }
    const midA = l.cardPos.a.y + CARD_HEIGHTS.l / 2
    expect(insertIndexAt(l, cards, cell, midA - 1)).toBe(0)
    expect(insertIndexAt(l, cards, cell, midA + 1)).toBe(1)
  })
})

describe('cellAt', () => {
  const l = computeLayout(config, [])

  it('finds the cell under a point', () => {
    expect(cellAt(l, l.cols[1].x + 5, l.rows[1].y + 5)).toEqual({ laneId: 't2', sprintId: 's2' })
  })

  it('treats left edges as inside and right/bottom edges as outside', () => {
    expect(cellAt(l, l.cols[0].x, l.rows[0].y)).toEqual({ laneId: 't1', sprintId: 's1' })
    expect(cellAt(l, l.cols[0].x + COL_W, l.rows[0].y)).toEqual({ laneId: 't1', sprintId: 's2' })
    expect(cellAt(l, l.cols[0].x, l.rows[0].y + l.rows[0].h)).toEqual({ laneId: 't2', sprintId: 's1' })
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
    expect(cellAt(l, l.cols[0].x + 5, ext.y + 1)).toEqual({ laneId: EXTERNAL_LANE_ID, sprintId: 's1' })
  })
})

describe('insertIndexAt', () => {
  const cell = { laneId: 't1', sprintId: 's1' }
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
