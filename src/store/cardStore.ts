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
