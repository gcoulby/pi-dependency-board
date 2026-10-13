import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { BoardConfig, CardType, CardTypeId, Sprint, SprintId, Team, TeamId } from '../types'
import { EXTERNAL_LANE_ID } from '../types'
import { createDefaultBoard, DEFAULT_CARD_TYPES, PROTECTED_CARD_TYPE_IDS, TEAM_PALETTE } from '../board/defaults'
import { isValidHex } from '../lib/cardTypeStyle'

function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

interface BoardStoreState extends BoardConfig {
  loadBoard: (config: BoardConfig) => void
  reset: () => void

  setPi: (pi: Partial<BoardConfig['pi']>) => void
  setExternalLabel: (label: string) => void

  // These only touch the config. Guarded deletes (cards must go somewhere) live in boardActions.
  addTeam: (name?: string) => Team
  updateTeam: (id: TeamId, updates: Partial<Omit<Team, 'id'>>) => void
  moveTeam: (id: TeamId, toIndex: number) => void
  removeTeam: (id: TeamId) => void

  addSprint: (name?: string) => Sprint
  updateSprint: (id: SprintId, updates: Partial<Omit<Sprint, 'id'>>) => void
  moveSprint: (id: SprintId, toIndex: number) => void
  removeSprint: (id: SprintId) => void
  /** Fill sprint start/end in consecutive two-week blocks from `pi.startDate`. Innovation sprints are one week. */
  autofillSprintDates: () => void

  addCardType: (type?: Partial<Omit<CardType, 'id'>>) => CardType
  updateCardType: (id: CardTypeId, updates: Partial<Omit<CardType, 'id'>>) => void
  moveCardType: (id: CardTypeId, toIndex: number) => void
  removeCardType: (id: CardTypeId) => void
  /** Adds back any default card type whose id is missing. Never touches existing types. Returns how many were added. */
  restoreDefaultCardTypes: () => number
}

function newTeamId(): string {
  const id = nanoid(8)
  return id === EXTERNAL_LANE_ID ? nanoid(10) : id
}

const initial = (): BoardConfig => createDefaultBoard()

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const useBoardStore = create<BoardStoreState>((set, get) => ({
  ...initial(),

  loadBoard: (config) =>
    set({
      pi: config.pi,
      teams: config.teams,
      sprints: config.sprints,
      cardTypes: config.cardTypes,
      externalLane: config.externalLane,
    }),

  reset: () => set(initial()),

  setPi: (pi) => set((s) => ({ pi: { ...s.pi, ...pi } })),
  setExternalLabel: (label) => set({ externalLane: { label } }),

  addTeam: (name) => {
    const { teams } = get()
    const team: Team = {
      id: newTeamId(),
      name: name?.trim() || `Team ${teams.length + 1}`,
      colour: TEAM_PALETTE[teams.length % TEAM_PALETTE.length],
    }
    set({ teams: [...teams, team] })
    return team
  },
  updateTeam: (id, updates) =>
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === id
          ? { ...t, ...updates, colour: updates.colour && isValidHex(updates.colour) ? updates.colour : t.colour }
          : t,
      ),
    })),
  moveTeam: (id, toIndex) =>
    set((s) => ({ teams: move(s.teams, s.teams.findIndex((t) => t.id === id), toIndex) })),
  removeTeam: (id) => set((s) => ({ teams: s.teams.filter((t) => t.id !== id) })),

  addSprint: (name) => {
    const { sprints } = get()
    const sprint: Sprint = { id: nanoid(8), name: name?.trim() || `Sprint ${sprints.length + 1}` }
    set({ sprints: [...sprints, sprint] })
    return sprint
  },
  updateSprint: (id, updates) =>
    set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === id ? { ...sp, ...updates } : sp)) })),
  moveSprint: (id, toIndex) =>
    set((s) => ({ sprints: move(s.sprints, s.sprints.findIndex((sp) => sp.id === id), toIndex) })),
  removeSprint: (id) => set((s) => ({ sprints: s.sprints.filter((sp) => sp.id !== id) })),

  autofillSprintDates: () => {
    const { pi, sprints } = get()
    if (!pi.startDate) return
    let cursor = pi.startDate
    const next = sprints.map((sp) => {
      const len = sp.isInnovation ? 7 : 14
      const start = cursor
      const end = addDays(start, len - 3) // two-week sprint ends on the Friday of week two
      cursor = addDays(start, len)
      return { ...sp, start, end }
    })
    set({ sprints: next })
  },

  addCardType: (type) => {
    const t: CardType = {
      id: nanoid(8),
      name: type?.name?.trim() || 'New type',
      colour: type?.colour && isValidHex(type.colour) ? type.colour : '#58a6ff',
      icon: type?.icon ?? 'Puzzle',
    }
    set((s) => ({ cardTypes: [...s.cardTypes, t] }))
    return t
  },
  updateCardType: (id, updates) =>
    set((s) => ({
      cardTypes: s.cardTypes.map((t) =>
        t.id === id
          ? { ...t, ...updates, colour: updates.colour && isValidHex(updates.colour) ? updates.colour : t.colour }
          : t,
      ),
    })),
  moveCardType: (id, toIndex) =>
    set((s) => ({ cardTypes: move(s.cardTypes, s.cardTypes.findIndex((t) => t.id === id), toIndex) })),
  removeCardType: (id) => {
    if (PROTECTED_CARD_TYPE_IDS.includes(id)) return
    set((s) => ({ cardTypes: s.cardTypes.filter((t) => t.id !== id) }))
  },
  restoreDefaultCardTypes: () => {
    const have = new Set(get().cardTypes.map((t) => t.id))
    const missing = DEFAULT_CARD_TYPES.filter((t) => !have.has(t.id)).map((t) => ({ ...t }))
    if (missing.length) set((s) => ({ cardTypes: [...s.cardTypes, ...missing] }))
    return missing.length
  },
}))

export function getBoardConfig(): BoardConfig {
  const { pi, teams, sprints, cardTypes, externalLane } = useBoardStore.getState()
  return { pi, teams, sprints, cardTypes, externalLane }
}
