import type { CardTypeId, LaneId, SprintId, TeamId } from '../types'
import { EXTERNAL_LANE_ID } from '../types'
import { PROTECTED_CARD_TYPE_IDS } from '../board/defaults'
import { useBoardStore } from './boardStore'
import { useCardStore } from './cardStore'
import { useViewStore } from './viewStore'

/**
 * Guarded deletes. A card must never point at a team, sprint or type that no
 * longer exists, so each of these either relocates or removes the affected
 * cards in the same step and refuses when there is nowhere for them to go.
 */

export function countCardsInLane(laneId: LaneId): number {
  return useCardStore.getState().cards.filter((c) => c.laneId === laneId).length
}
export function countCardsInSprint(sprintId: SprintId): number {
  return useCardStore.getState().cards.filter((c) => c.sprintId === sprintId).length
}
export function countCardsOfType(typeId: CardTypeId): number {
  return useCardStore.getState().cards.filter((c) => c.typeId === typeId).length
}

export type TeamResolution = { type: 'move'; to: TeamId | typeof EXTERNAL_LANE_ID } | { type: 'delete' }

export function deleteTeam(id: TeamId, resolution?: TeamResolution): boolean {
  const board = useBoardStore.getState()
  const cards = useCardStore.getState()
  if (!board.teams.some((t) => t.id === id)) return false

  if (countCardsInLane(id) > 0) {
    if (!resolution) return false
    if (resolution.type === 'delete') {
      cards.deleteCards((c) => c.laneId === id)
    } else {
      const validTarget = resolution.to === EXTERNAL_LANE_ID || (resolution.to !== id && board.teams.some((t) => t.id === resolution.to))
      if (!validTarget) return false
      cards.patchCards((c) => c.laneId === id, { laneId: resolution.to })
    }
  }
  cards.patchCards((c) => c.owner === id, { owner: undefined })
  board.removeTeam(id)
  if (useViewStore.getState().activeLaneId === id) useViewStore.getState().setActiveLane(null)
  return true
}

export function deleteSprint(id: SprintId, moveToSprintId?: SprintId): boolean {
  const board = useBoardStore.getState()
  if (!board.sprints.some((s) => s.id === id)) return false
  if (board.sprints.length <= 1) return false // a board needs at least one column

  if (countCardsInSprint(id) > 0) {
    if (!moveToSprintId || moveToSprintId === id || !board.sprints.some((s) => s.id === moveToSprintId)) return false
    useCardStore.getState().patchCards((c) => c.sprintId === id, { sprintId: moveToSprintId })
  }
  board.removeSprint(id)
  return true
}

export function deleteCardType(id: CardTypeId, reassignTo?: CardTypeId): boolean {
  const board = useBoardStore.getState()
  if (!board.cardTypes.some((t) => t.id === id)) return false
  if (PROTECTED_CARD_TYPE_IDS.includes(id)) return false // Requirement and Dependency are permanent
  if (board.cardTypes.length <= 1) return false // every card needs a type

  if (countCardsOfType(id) > 0) {
    if (!reassignTo || reassignTo === id || !board.cardTypes.some((t) => t.id === reassignTo)) return false
    useCardStore.getState().patchCards((c) => c.typeId === id, { typeId: reassignTo })
  }
  board.removeCardType(id)
  if (useViewStore.getState().activeTypeId === id) useViewStore.getState().setActiveType(null)
  return true
}
