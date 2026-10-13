import type { Card, CardId, Dependency, ScheduleCheck, Sprint } from '../types'
import { slotIndex } from './slots'

export function checkSchedule(
  dep: Pick<Dependency, 'from' | 'to'>,
  cards: Card[] | Record<CardId, Card>,
  sprints: Sprint[],
): ScheduleCheck {
  const byId = Array.isArray(cards) ? Object.fromEntries(cards.map((c) => [c.id, c])) : cards
  const from = byId[dep.from]
  const to = byId[dep.to]
  if (!from || !to) return 'ok'
  const fi = sprints.findIndex((s) => s.id === from.sprintId)
  const ti = sprints.findIndex((s) => s.id === to.sprintId)
  if (fi < 0 || ti < 0) return 'ok'
  if (fi < ti) return 'ok'
  if (fi > ti) return 'conflict'
  // Same sprint: the slot (start, mid, end) decides
  const fs = slotIndex(from.slot)
  const ts = slotIndex(to.slot)
  if (fs < ts) return 'ok'
  return fs === ts ? 'same-sprint' : 'conflict'
}

function adjacency(dependencies: Dependency[], reverse = false): Map<CardId, CardId[]> {
  const adj = new Map<CardId, CardId[]>()
  for (const d of dependencies) {
    const [a, b] = reverse ? [d.to, d.from] : [d.from, d.to]
    const list = adj.get(a)
    if (list) list.push(b)
    else adj.set(a, [b])
  }
  return adj
}

function reach(start: CardId, adj: Map<CardId, CardId[]>): Set<CardId> {
  const seen = new Set<CardId>()
  const queue = [start]
  while (queue.length) {
    const id = queue.shift()!
    for (const next of adj.get(id) ?? []) {
      if (seen.has(next) || next === start) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}

/** Everything that must be delivered before `cardId` (transitive, excludes the card itself). */
export function upstream(cardId: CardId, dependencies: Dependency[]): Set<CardId> {
  return reach(cardId, adjacency(dependencies, true))
}

/** Everything that needs `cardId` (transitive, excludes the card itself). */
export function downstream(cardId: CardId, dependencies: Dependency[]): Set<CardId> {
  return reach(cardId, adjacency(dependencies))
}

/**
 * Dependency cycles, one array of card ids per strongly connected component
 * that contains a cycle (size > 1, or a self-loop). Tarjan, iterative.
 */
export function findCycles(dependencies: Dependency[]): CardId[][] {
  const adj = adjacency(dependencies)
  const nodes = new Set<CardId>()
  dependencies.forEach((d) => {
    nodes.add(d.from)
    nodes.add(d.to)
  })

  const index = new Map<CardId, number>()
  const low = new Map<CardId, number>()
  const onStack = new Set<CardId>()
  const stack: CardId[] = []
  const result: CardId[][] = []
  let counter = 0

  for (const root of nodes) {
    if (index.has(root)) continue
    const work: { id: CardId; i: number }[] = [{ id: root, i: 0 }]
    index.set(root, counter)
    low.set(root, counter)
    counter++
    stack.push(root)
    onStack.add(root)

    while (work.length) {
      const frame = work[work.length - 1]
      const next = adj.get(frame.id) ?? []
      if (frame.i < next.length) {
        const w = next[frame.i++]
        if (!index.has(w)) {
          index.set(w, counter)
          low.set(w, counter)
          counter++
          stack.push(w)
          onStack.add(w)
          work.push({ id: w, i: 0 })
        } else if (onStack.has(w)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, index.get(w)!))
        }
      } else {
        work.pop()
        if (work.length) {
          const parent = work[work.length - 1].id
          low.set(parent, Math.min(low.get(parent)!, low.get(frame.id)!))
        }
        if (low.get(frame.id) === index.get(frame.id)) {
          const comp: CardId[] = []
          let w: CardId
          do {
            w = stack.pop()!
            onStack.delete(w)
            comp.push(w)
          } while (w !== frame.id)
          const selfLoop = comp.length === 1 && (adj.get(comp[0]) ?? []).includes(comp[0])
          if (comp.length > 1 || selfLoop) result.push(comp.reverse())
        }
      }
    }
  }
  return result
}
