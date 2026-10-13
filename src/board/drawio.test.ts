import { describe, expect, it } from 'vitest'
import type { BoardConfig, Card, Dependency } from '../types'
import { boardToDrawio } from './drawio'
import { computeLayout } from './layout'

const config: BoardConfig = {
  pi: { name: 'PI & <1>' },
  teams: [
    { id: 't1', name: 'Payments', colour: '#58a6ff' },
    { id: 't2', name: 'Identity', colour: '#a78bfa' },
  ],
  sprints: [{ id: 's1', name: 'Sprint 1', start: '2026-11-02', end: '2026-11-13' }, { id: 's2', name: 'IP', isInnovation: true }],
  cardTypes: [{ id: 'feature', name: 'Feature', colour: '#58a6ff', icon: 'Layers' }],
  externalLane: { label: 'External' },
}
const card = (id: string, laneId: string, sprintId: string, title: string, extra: Partial<Card> = {}): Card => ({
  id, title, typeId: 'feature', laneId, sprintId, order: 0, tags: [], properties: {}, hasContent: false, createdAt: '', updatedAt: '', ...extra,
})
const dep = (id: string, from: string, to: string): Dependency => ({ id, from, to, state: 'proposed', createdAt: '' })

describe('boardToDrawio', () => {
  const cards = [card('a', 't1', 's1', 'Tokenise <cards> & "more"'), card('b', 't2', 's2', 'Login', { slot: 'end' })]
  const out = boardToDrawio(config, cards, [dep('1', 'a', 'b')])

  it('is a draw.io file with the board background', () => {
    expect(out.startsWith('<mxfile')).toBe(true)
    expect(out).toContain('background="#0d1117"')
    expect(out).toContain('<mxCell id="0"/><mxCell id="1" parent="0"/>')
  })

  it('escapes special characters so the XML stays valid', () => {
    expect(out).toContain('Tokenise &amp;lt;cards&amp;gt; &amp;amp; &amp;quot;more&amp;quot;'.replace('&amp;quot;', '&quot;').replace('&amp;quot;', '&quot;'))
    expect(out).toContain('PI &amp;amp; &amp;lt;1&amp;gt;')
  })

  it('places cards at the same coordinates and heights as the board layout', () => {
    const layout = computeLayout(config, cards)
    const b = layout.cardPos.b
    expect(out).toContain(`<mxGeometry x="${b.x}" y="${b.y}" width="224" height="84" as="geometry"/>`)
  })

  it('connects provider to dependant with an edge', () => {
    expect(out).toMatch(/edge="1" parent="1" source="n\d+" target="n\d+"/)
    expect(out).toContain('endArrow=block')
  })

  it('draws the external row dashed', () => {
    expect(out).toContain('dashed=1;')
  })
})
