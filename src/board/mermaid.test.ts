import { describe, expect, it } from 'vitest'
import type { BoardConfig, Card, Dependency } from '../types'
import { boardToMermaid } from './mermaid'

const config: BoardConfig = {
  pi: { name: 'PI' },
  teams: [{ id: 't1', name: 'Payments', colour: '#58a6ff' }],
  sprints: [
    { id: 's1', name: 'Sprint 1' },
    { id: 's2', name: 'Sprint 2' },
  ],
  cardTypes: [{ id: 'feature', name: 'Feature', colour: '#58a6ff', icon: 'Layers' }],
  externalLane: { label: 'External' },
}
const card = (id: string, laneId: string, sprintId: string, title: string): Card => ({
  id, title, typeId: 'feature', laneId, sprintId, order: 0, tags: [], properties: {}, hasContent: false, createdAt: '', updatedAt: '',
})
const dep = (id: string, from: string, to: string, state: Dependency['state'] = 'proposed', label?: string): Dependency => ({
  id, from, to, state, label, createdAt: '',
})

describe('boardToMermaid', () => {
  const cards = [card('a', 't1', 's1', 'Tokenise "cards"'), card('b', 't1', 's2', 'Checkout'), card('x', 'external', 's1', 'Vendor API')]

  it('groups cards by sprint then team, and includes the external lane', () => {
    const m = boardToMermaid(config, cards, [])
    expect(m.startsWith('flowchart LR')).toBe(true)
    expect(m).toContain('subgraph S0["Sprint 1"]')
    expect(m).toContain('["Payments"]')
    expect(m).toContain('["External"]')
    expect(m).toContain('subgraph S1["Sprint 2"]')
  })

  it('escapes quotes in titles', () => {
    expect(boardToMermaid(config, cards, [])).toContain('Tokenise #quot;cards#quot;')
  })

  it('draws dependency state as line style, with the arrow pointing at the dependant', () => {
    const m = boardToMermaid(config, cards, [dep('1', 'a', 'b', 'agreed', 'API')])
    expect(m).toContain('c1 -->|"API"| c2')
    expect(boardToMermaid(config, cards, [dep('1', 'a', 'b')])).toContain('c1 -.-> c2')
  })

  it('colours schedule conflicts red', () => {
    // b (sprint 2) must come first for a (sprint 1): provider is later
    const m = boardToMermaid(config, cards, [dep('1', 'a', 'b'), dep('2', 'b', 'a')])
    expect(m).toContain('linkStyle 1 stroke:#f85149')
  })

  it('skips sprints with no cards and dependencies with missing cards', () => {
    const m = boardToMermaid(config, [card('a', 't1', 's1', 'Only')], [dep('1', 'a', 'gone')])
    expect(m).not.toContain('Sprint 2')
    expect(m).not.toContain('-->')
  })
})
