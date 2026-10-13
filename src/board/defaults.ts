import { nanoid } from 'nanoid'
import type { BoardConfig, CardType, Sprint, Team } from '../types'

export const DEFAULT_CARD_TYPES: CardType[] = [
  { id: 'feature', name: 'Feature', colour: '#58a6ff', icon: 'Layers' },
  { id: 'enabler', name: 'Enabler', colour: '#a78bfa', icon: 'Wrench' },
  { id: 'spike', name: 'Spike', colour: '#2dd4bf', icon: 'FlaskConical' },
  { id: 'tech-debt', name: 'Tech debt', colour: '#8b949e', icon: 'Hammer' },
  { id: 'risk', name: 'Risk', colour: '#fb7185', icon: 'ShieldAlert' },
  { id: 'milestone', name: 'Milestone', colour: '#3fb950', icon: 'Flag' },
  // Requirement: something a team needs. Dependency: something someone provides to meet a requirement.
  { id: 'requirement', name: 'Requirement', colour: '#e3c340', icon: 'Target' },
  { id: 'dependency', name: 'Dependency', colour: '#2ea043', icon: 'Package' },
]

export const TEAM_PALETTE = ['#58a6ff', '#a78bfa', '#2dd4bf', '#f0883e', '#fb7185', '#3fb950', '#d2a8ff', '#79c0ff']

/** Presets offered by the colour pickers. Amber is deliberately absent: it is reserved for selection. */
export const COLOUR_PRESETS = [
  '#58a6ff', '#a78bfa', '#2dd4bf', '#8b949e', '#fb7185', '#3fb950',
  '#f0883e', '#d2a8ff', '#79c0ff', '#56d364', '#ff7b72', '#e2c5ff',
]

export interface NewBoardOptions {
  piName: string
  sprintCount: number
  /** Make the last sprint an Innovation and Planning sprint. */
  innovationLast: boolean
  teamNames: string[]
}

export const DEFAULT_TEAM_NAMES = ['Team A', 'Team B', 'Team C']

export function createDefaultBoard(opts?: Partial<NewBoardOptions>): BoardConfig {
  const piName = opts?.piName?.trim() || 'PI 1'
  const count = Math.min(12, Math.max(1, Math.round(opts?.sprintCount ?? 5)))
  const innovationLast = opts?.innovationLast ?? true
  const names = (opts?.teamNames ?? DEFAULT_TEAM_NAMES).map((n) => n.trim()).filter(Boolean)

  const teams: Team[] = (names.length ? names : DEFAULT_TEAM_NAMES).map((name, i) => ({
    id: nanoid(8),
    name,
    colour: TEAM_PALETTE[i % TEAM_PALETTE.length],
  }))

  const sprints: Sprint[] = Array.from({ length: count }, (_, i) => {
    const isIP = innovationLast && i === count - 1 && count > 1
    return isIP
      ? { id: nanoid(8), name: 'IP', isInnovation: true }
      : { id: nanoid(8), name: `Sprint ${i + 1}` }
  })

  return {
    pi: { name: piName },
    teams,
    sprints,
    cardTypes: DEFAULT_CARD_TYPES.map((t) => ({ ...t })),
    externalLane: { label: 'External dependencies' },
  }
}
