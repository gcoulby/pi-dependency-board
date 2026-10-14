import { create } from 'zustand'

export type Theme = 'dark' | 'light'

/** Text size steps for cards and the row / column headers. 1 is the default. */
export const FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2] as const

interface UiState {
  theme: Theme
  fontScale: number
  /** Sidebar collapsed. Remembered. */
  sidebarHidden: boolean
  /** Canvas fills the window: toolbar, sidebar and card panel are hidden. Never remembered. */
  canvasOnly: boolean
  toggleSidebar: () => void
  setCanvasOnly: (on: boolean) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  /** Moves one step along FONT_SCALES. */
  stepFont: (direction: 1 | -1) => void
}

const KEY = 'piboard-ui'

// Ephemeral UI preferences only. Never board data.
function load(): { theme: Theme; fontScale: number; sidebarHidden: boolean } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as Partial<{ theme: Theme; fontScale: number; sidebarHidden: boolean }>
      return {
        theme: v.theme === 'light' ? 'light' : 'dark',
        fontScale: FONT_SCALES.includes(v.fontScale as (typeof FONT_SCALES)[number]) ? (v.fontScale as number) : 1,
        sidebarHidden: v.sidebarHidden === true,
      }
    }
  } catch {
    /* storage unavailable: use defaults */
  }
  return { theme: 'dark', fontScale: 1, sidebarHidden: false }
}

function save(theme: Theme, fontScale: number, sidebarHidden: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ theme, fontScale, sidebarHidden }))
  } catch {
    /* ignore */
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  ...load(),
  canvasOnly: false,
  toggleSidebar: () => set({ sidebarHidden: !get().sidebarHidden }),
  setCanvasOnly: (canvasOnly) => set({ canvasOnly }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
  stepFont: (direction) => {
    const i = FONT_SCALES.indexOf(get().fontScale as (typeof FONT_SCALES)[number])
    const next = FONT_SCALES[Math.max(0, Math.min(FONT_SCALES.length - 1, (i < 0 ? 1 : i) + direction))]
    set({ fontScale: next })
  },
}))

function apply(theme: Theme, fontScale: number) {
  const root = document.documentElement
  root.dataset.theme = theme
  // Only cards and the row / column headers read this. The rest of the interface keeps its size.
  root.style.setProperty('--fs', String(fontScale))
}

/** Apply the saved preferences before first paint, then keep the document and storage in step. */
export function initUi() {
  const { theme, fontScale } = useUiStore.getState()
  apply(theme, fontScale)
  useUiStore.subscribe((s) => {
    apply(s.theme, s.fontScale)
    save(s.theme, s.fontScale, s.sidebarHidden)
  })
}
