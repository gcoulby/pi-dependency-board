import type { Card, CardId, Dependency, DependencyId, ScheduleCheck, Sprint } from '../types'
import { checkSchedule, findCycles } from './dependencies'

export interface ScheduleIssue<K extends 'conflict' | 'same-sprint'> {
  kind: K
  dependencyId: DependencyId
  from: CardId
  to: CardId
}

export interface CycleIssue {
  kind: 'cycle'
  cards: CardId[]
}

export interface IssueSummary {
  conflicts: ScheduleIssue<'conflict'>[]
  sameSprint: ScheduleIssue<'same-sprint'>[]
  cycles: CycleIssue[]
  checks: Record<DependencyId, ScheduleCheck>
}

export function findIssues(cards: Card[], dependencies: Dependency[], sprints: Sprint[]): IssueSummary {
  const byId = Object.fromEntries(cards.map((c) => [c.id, c])) as Record<CardId, Card>
  const checks: Record<DependencyId, ScheduleCheck> = {}
  const conflicts: IssueSummary['conflicts'] = []
  const sameSprint: IssueSummary['sameSprint'] = []

  for (const d of dependencies) {
    const check = checkSchedule(d, byId, sprints)
    checks[d.id] = check
    if (check === 'conflict') conflicts.push({ kind: 'conflict', dependencyId: d.id, from: d.from, to: d.to })
    else if (check === 'same-sprint') sameSprint.push({ kind: 'same-sprint', dependencyId: d.id, from: d.from, to: d.to })
  }

  const cycles = findCycles(dependencies).map((c) => ({ kind: 'cycle' as const, cards: c }))
  return { conflicts, sameSprint, cycles, checks }
}
