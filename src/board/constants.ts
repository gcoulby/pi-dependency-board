export const LABEL_COL_W = 168
export const HEADER_H = 52
export const CELL_PAD = 20
export const CARD_W = 224
export const CARD_H = 84
export const CARD_GAP = 28
// Each sprint column holds two sub-columns: start and end of sprint
export const SLOTS = ['start', 'end'] as const
export const SLOT_W = CARD_W + CELL_PAD * 2
export const COL_W = SLOT_W * SLOTS.length
export const MIN_ROW_H = 140
export const EXTERNAL_GAP = 40

export type CardSizeKey = 's' | 'm' | 'l'

/** Cards are resized per ticket. Width never changes, so columns stay fixed; only height varies. */
export const CARD_HEIGHTS: Record<CardSizeKey, number> = {
  s: 60,
  m: CARD_H,
  l: 116,
}

export function cardHeight(size: CardSizeKey | undefined): number {
  return CARD_HEIGHTS[size ?? 'm'] ?? CARD_H
}
