import type { Card, SprintSlot } from '../types'
import { SLOTS } from './constants'

export const DEFAULT_SLOT: SprintSlot = 'start'

export function slotOf(card: Pick<Card, 'slot'>): SprintSlot {
  return card.slot ?? DEFAULT_SLOT
}

export function slotIndex(slot: SprintSlot | undefined): number {
  const i = SLOTS.indexOf(slot ?? DEFAULT_SLOT)
  return i < 0 ? SLOTS.indexOf(DEFAULT_SLOT) : i
}
