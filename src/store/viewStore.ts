import { create } from 'zustand'
import type { CardId, CardTypeId, DependencyId, LaneId, Viewport } from '../types'

export type PanTarget = { kind: 'card'; id: CardId; nonce: number } | { kind: 'dependency'; id: DependencyId; nonce: number }

interface ViewStoreState {
  /** The only field written to disk. Never subscribe to it from components that should not re-render on pan. */
  viewport: Viewport
  activeTypeId: CardTypeId | null
  activeLaneId: LaneId | null
  /** The selected card. Selecting a card puts the board in focus mode. */
  focusCardId: CardId | null
  selectedDependencyId: DependencyId | null
  /** The dependency whose dialog is open. */
  editingDependencyId: DependencyId | null
  panTarget: PanTarget | null
  fitNonce: number

  setViewport: (viewport: Viewport) => void
  setActiveType: (id: CardTypeId | null) => void
  setActiveLane: (id: LaneId | null) => void
  setFocusCard: (id: CardId | null) => void
  selectDependency: (id: DependencyId | null) => void
  openDependency: (id: DependencyId | null) => void
  panTo: (target: { kind: 'card' | 'dependency'; id: string }) => void
  requestFit: () => void
  clearFilters: () => void
  loadView: (viewport: Viewport) => void
  reset: () => void
}

let nonce = 0

export const useViewStore = create<ViewStoreState>((set) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  activeTypeId: null,
  activeLaneId: null,
  focusCardId: null,
  selectedDependencyId: null,
  editingDependencyId: null,
  panTarget: null,
  fitNonce: 0,

  setViewport: (viewport) => set({ viewport }),
  setActiveType: (activeTypeId) => set({ activeTypeId }),
  setActiveLane: (activeLaneId) => set({ activeLaneId }),
  setFocusCard: (focusCardId) => set((s) => ({ focusCardId, selectedDependencyId: focusCardId ? null : s.selectedDependencyId })),
  selectDependency: (selectedDependencyId) => set({ selectedDependencyId }),
  openDependency: (id) => set((s) => ({ editingDependencyId: id, selectedDependencyId: id ?? s.selectedDependencyId })),
  panTo: (target) => set({ panTarget: { ...target, nonce: ++nonce } as PanTarget }),
  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
  clearFilters: () => set({ activeTypeId: null, activeLaneId: null }),
  loadView: (viewport) =>
    set({ viewport, activeTypeId: null, activeLaneId: null, focusCardId: null, selectedDependencyId: null, editingDependencyId: null, panTarget: null }),
  reset: () =>
    set({ viewport: { x: 0, y: 0, zoom: 1 }, activeTypeId: null, activeLaneId: null, focusCardId: null, selectedDependencyId: null, editingDependencyId: null, panTarget: null }),
}))
