export type Side = 'top' | 'right' | 'bottom' | 'left'

export interface Box {
  x: number
  y: number
  h: number
}

/**
 * Which sides of two cards a dependency joins. Cards that sit above or below one
 * another connect bottom to top (or top to bottom). Only cards at the same height
 * connect side to side. The line itself is always straight, so it is easy to trace.
 */
export function pickSides(from: Box, to: Box): { source: Side; target: Side } {
  if (to.y >= from.y + from.h) return { source: 'bottom', target: 'top' }
  if (to.y + to.h <= from.y) return { source: 'top', target: 'bottom' }
  return to.x >= from.x ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' }
}
