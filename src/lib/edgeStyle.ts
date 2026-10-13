import type { DependencyState, ScheduleCheck } from '../types'

export const CONFLICT_COLOUR = '#f85149'

const STATE_COLOUR: Record<DependencyState, string> = {
  proposed: '#8b949e',
  agreed: '#3fb950',
  'at-risk': '#f0883e',
}

/** Precedence: schedule conflict first, then dependency state. */
export function edgeAppearance(state: DependencyState, check: ScheduleCheck) {
  if (check === 'conflict') return { colour: CONFLICT_COLOUR, width: 3, dash: '8 5' }
  return { colour: STATE_COLOUR[state], width: 1.75, dash: state === 'proposed' ? '6 4' : undefined }
}

