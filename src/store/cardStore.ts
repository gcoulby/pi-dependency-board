import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Card, CardId, Dependency, DependencyId, LaneId, SprintId, SprintSlot } from '../types'
import { slotOf } from '../board/slots'

export type NewCard = Pick<Card, 'title' | 'typeId' | 'laneId' | 'sprintId'> &
  Partial<Omit<Card, 'id' | 'order' | 'createdAt' | 'updatedAt' | 'title' | 'typeId' | 'laneId' | 'sprintId'>>

interface CardStoreState {
  cards: Card[]
  dependencies: Dependency[]

  addCard: (card: NewCard, index?: number) => Card
  updateCard: (id: CardId, updates: Partial<Omit<Card, 'id'>>) => void
  deleteCard: (id: CardId) => void
  duplicateCard: (id: CardId) => Card | null
  /** Moves a card into a cell at `index` and renumbers `order` 0..n in both affected cells. `slot` defaults to the card's current slot. */
  moveCard: (id: CardId, laneId: LaneId, sprintId: SprintId, index: number, slot?: SprintSlot) => void

  /** Returns null for self-links and duplicates. Never rejects conflicts or cycles. */
  addDependency: (dep: Pick<Dependency, 'from' | 'to'> & Partial<Pick<Dependency, 'label' | 'notes' | 'state'>>) => Dependency | null
  updateDependency: (id: DependencyId, updates: Partial<Omit<Dependency, 'id'>>) => void
  deleteDependency: (id: DependencyId) => void

  /** Bulk reference rewrite used by guarded deletes in boardActions. */
  patchCards: (match: (c: Card) => boolean, patch: Partial<Card>) => void
  deleteCards: (match: (c: Card) => boolean) => void

  loadCards: (cards: Card[], dependencies: Dependency[]) => void
  reset: () => void
}

/** A cell is a (lane, sprint, slot) triple: start or end of the sprint. */
interface CellKey {
  laneId: LaneId
  sprintId: SprintId
  slot: SprintSlot
}

const sameCell = (a: Card, cell: CellKey) =>
  a.laneId === cell.laneId && a.sprintId === cell.sprintId && slotOf(a) === cell.slot

const cellKeyOf = (c: Card): CellKey => ({ laneId: c.laneId, sprintId: c.sprintId, slot: slotOf(c) })

/** Cards of a cell in `order`, ties broken stably by array position. */
function cellOf(cards: Card[], cell: CellKey): Card[] {
  return cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => sameCell(c, cell))
    .sort((a, b) => a.c.order - b.c.order || a.i - b.i)
    .map(({ c }) => c)
}

/** Rewrites `order` 0..n for the given cells, leaving every other card untouched. */
function renumber(cards: Card[], cells: CellKey[]): Card[] {
  const orders = new Map<CardId, number>()
  const seen = new Set<string>()
  for (const cell of cells) {
    const key = `${cell.laneId}\u0000${cell.sprintId}\u0000${cell.slot}`
    if (seen.has(key)) continue
    seen.add(key)
    cellOf(cards, cell).forEach((c, i) => orders.set(c.id, i))
  }
  return cards.map((c) => (orders.has(c.id) && orders.get(c.id) !== c.order ? { ...c, order: orders.get(c.id)! } : c))
}

export const useCardStore = create<CardStoreState>((set, get) => ({
  cards: [],
  dependencies: [],

  addCard: (data, index) => {
    const now = new Date().toISOString()
    const { cards } = get()
    const cell: CellKey = { laneId: data.laneId, sprintId: data.sprintId, slot: data.slot ?? 'start' }
    const stackLen = cellOf(cards, cell).length
    const at = index === undefined ? stackLen : Math.max(0, Math.min(index, stackLen))
    const card: Card = {
      tags: [],
      properties: {},
      hasContent: false,
      ...data,
      id: nanoid(),
      order: at - 0.5, // sorts between neighbours; renumber makes it an integer
      createdAt: now,
      updatedAt: now,
    }
    set({ cards: renumber([...cards, card], [cellKeyOf(card)]) })
    return get().cards.find((c) => c.id === card.id)!
  },

  updateCard: (id, updates) =>
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)),
    })),

  deleteCard: (id) =>
    set((s) => {
      const card = s.cards.find((c) => c.id === id)
      if (!card) return s
      const rest = s.cards.filter((c) => c.id !== id)
      return {
        cards: renumber(rest, [cellKeyOf(card)]),
        dependencies: s.dependencies.filter((d) => d.from !== id && d.to !== id),
      }
    }),

  duplicateCard: (id) => {
    const src = get().cards.find((c) => c.id === id)
    if (!src) return null
    const idx = cellOf(get().cards, cellKeyOf(src)).findIndex((c) => c.id === id)
    return get().addCard(
      {
        title: `${src.title} (copy)`,
        typeId: src.typeId,
        laneId: src.laneId,
        sprintId: src.sprintId,
        slot: src.slot,
        size: src.size,
        description: src.description,
        owner: src.owner,
        estimate: src.estimate,
        party: src.party,
        tags: [...src.tags],
        properties: { ...src.properties },
      },
      idx + 1,
    )
  },

  moveCard: (id, laneId, sprintId, index, slot) =>
    set((s) => {
      const card = s.cards.find((c) => c.id === id)
      if (!card) return s
      const from = cellKeyOf(card)
      const to: CellKey = { laneId, sprintId, slot: slot ?? slotOf(card) }
      // Position of the card within the target cell, with the card itself removed
      const target = cellOf(s.cards.filter((c) => c.id !== id), to)
      const at = Math.max(0, Math.min(index, target.length))
      const moved = { ...card, laneId, sprintId, slot: to.slot, order: at - 0.5, updatedAt: new Date().toISOString() }
      const cards = s.cards.map((c) => (c.id === id ? moved : c))
      return { cards: renumber(cards, [from, to]) }
    }),

  addDependency: (dep) => {
    const { dependencies, cards } = get()
    if (dep.from === dep.to) return null
    if (!cards.some((c) => c.id === dep.from) || !cards.some((c) => c.id === dep.to)) return null
    if (dependencies.some((d) => d.from === dep.from && d.to === dep.to)) return null
    const created: Dependency = {
      state: 'proposed',
      ...dep,
      id: nanoid(),
      createdAt: new Date().toISOString(),
    }
    set({ dependencies: [...dependencies, created] })
    return created
  },

  updateDependency: (id, updates) =>
    set((s) => ({ dependencies: s.dependencies.map((d) => (d.id === id ? { ...d, ...updates } : d)) })),

  deleteDependency: (id) => set((s) => ({ dependencies: s.dependencies.filter((d) => d.id !== id) })),

  patchCards: (match, patch) =>
    set((s) => {
      const touched = s.cards.filter(match)
      if (!touched.length) return s
      const now = new Date().toISOString()
      const cells = [
        ...touched.map(cellKeyOf),
        ...touched.map((c) => ({
          laneId: patch.laneId ?? c.laneId,
          sprintId: patch.sprintId ?? c.sprintId,
          slot: patch.slot ?? slotOf(c),
        })),
      ]
      // Cards appended to a new cell go after existing ones, in their previous relative order
      const patched = s.cards.map((c) =>
        match(c)
          ? { ...c, ...patch, order: patch.laneId || patch.sprintId || patch.slot ? 1e6 + c.order : c.order, updatedAt: now }
          : c,
      )
      return { cards: renumber(patched, cells) }
    }),

  deleteCards: (match) =>
    set((s) => {
      const gone = new Set(s.cards.filter(match).map((c) => c.id))
      if (!gone.size) return s
      const cells = s.cards.filter((c) => gone.has(c.id)).map(cellKeyOf)
      return {
        cards: renumber(s.cards.filter((c) => !gone.has(c.id)), cells),
        dependencies: s.dependencies.filter((d) => !gone.has(d.from) && !gone.has(d.to)),
      }
    }),

  loadCards: (cards, dependencies) => set({ cards, dependencies }),
  reset: () => set({ cards: [], dependencies: [] }),
}))
