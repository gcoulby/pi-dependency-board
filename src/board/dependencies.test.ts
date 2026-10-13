import { describe, expect, it } from 'vitest'
import type { Card, Dependency, Sprint } from '../types'
import { checkSchedule, downstream, findCycles, upstream } from './dependencies'

const sprints: Sprint[] = [
  { id: 's1', name: 'S1' },
  { id: 's2', name: 'S2' },
  { id: 's3', name: 'S3' },
]

const card = (id: string, sprintId: string): Card => ({
  id, title: id, typeId: 'feature', laneId: 't1', sprintId, order: 0,
  tags: [], properties: {}, hasContent: false, createdAt: '', updatedAt: '',
})

const dep = (from: string, to: string): Dependency => ({
  id: `${from}-${to}`, from, to, state: 'proposed', createdAt: '',
})

describe('checkSchedule', () => {
  const cards = [card('a', 's1'), card('b', 's2'), card('c', 's2'), card('d', 's3')]

  it('is ok when the provider is in an earlier sprint', () => {
    expect(checkSchedule(dep('a', 'b'), cards, sprints)).toBe('ok')
  })

  it('flags the same sprint', () => {
    expect(checkSchedule(dep('b', 'c'), cards, sprints)).toBe('same-sprint')
  })

  it('flags a conflict when the provider is in a later sprint', () => {
    expect(checkSchedule(dep('d', 'a'), cards, sprints)).toBe('conflict')
  })

  it('is ok for dangling references', () => {
    expect(checkSchedule(dep('a', 'zzz'), cards, sprints)).toBe('ok')
  })
})

describe('upstream / downstream', () => {
  const deps = [dep('a', 'b'), dep('b', 'c'), dep('x', 'c'), dep('c', 'd'), dep('q', 'r')]

  it('collects transitive upstream', () => {
    expect(upstream('d', deps)).toEqual(new Set(['a', 'b', 'c', 'x']))
    expect(upstream('a', deps)).toEqual(new Set())
  })

  it('collects transitive downstream', () => {
    expect(downstream('a', deps)).toEqual(new Set(['b', 'c', 'd']))
    expect(downstream('d', deps)).toEqual(new Set())
  })

  it('terminates and excludes the start card when there is a cycle', () => {
    const cyc = [dep('a', 'b'), dep('b', 'c'), dep('c', 'a')]
    expect(downstream('a', cyc)).toEqual(new Set(['b', 'c']))
    expect(upstream('a', cyc)).toEqual(new Set(['b', 'c']))
  })
})

describe('findCycles', () => {
  it('returns nothing for an acyclic graph', () => {
    expect(findCycles([dep('a', 'b'), dep('b', 'c'), dep('a', 'c')])).toEqual([])
  })

  it('finds a three-card cycle', () => {
    const cycles = findCycles([dep('a', 'b'), dep('b', 'c'), dep('c', 'a'), dep('c', 'z')])
    expect(cycles).toHaveLength(1)
    expect([...cycles[0]].sort()).toEqual(['a', 'b', 'c'])
  })

  it('finds separate cycles', () => {
    const cycles = findCycles([dep('a', 'b'), dep('b', 'a'), dep('x', 'y'), dep('y', 'z'), dep('z', 'x')])
    expect(cycles).toHaveLength(2)
  })

  it('reports a self-loop', () => {
    expect(findCycles([dep('a', 'a')])).toEqual([['a']])
  })
})
