import { CARD_H, CARD_W } from './constants'

/** Width in px of a string at the card title's font and current text size. */
export type Measure = (text: string) => number

/**
 * Number of lines `text` wraps to inside `maxWidth`. Wraps at spaces and breaks a
 * word that is wider than a whole line, like the browser does for the card title.
 */
export function countLines(text: string, maxWidth: number, measure: Measure): number {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1
  const space = measure(' ')
  let lines = 1
  let lineW = 0

  for (const word of words) {
    let rest = word
    // A word wider than a whole line is broken across lines, like overflow-wrap: anywhere
    while (measure(rest) > maxWidth && rest.length > 1) {
      if (lineW > 0) {
        lines++
        lineW = 0
      }
      let take = rest.length - 1
      while (take > 1 && measure(rest.slice(0, take)) > maxWidth) take--
      rest = rest.slice(take)
      lines++
    }
    const w = measure(rest)
    if (lineW === 0) lineW = w
    else if (lineW + space + w <= maxWidth) lineW += space + w
    else {
      lines++
      lineW = w
    }
  }
  return lines
}

// Card geometry at text scale 1, in px. Everything inside a card is sized in rem, so it scales with `scale`.
const PAD_Y = 12 // py-1.5 top and bottom
const BADGE_H = 16
const TITLE_GAP = 4
const LINE_H = 15
const FOOTER_H = 18 // spacer plus the owner / estimate row
const PAD_L = 12 // pl-3
const PAD_R = 8 // pr-2
const BORDER = 2

/** Width available to the title text inside a card, at the given text scale. */
export function titleWidth(scale: number): number {
  return CARD_W - (PAD_L + PAD_R) * scale - BORDER
}

export interface FitInput {
  title: string
  hasFooter: boolean
  scale: number
  /** Measures text already set at the title font size for `scale`. */
  measure: Measure
}

/**
 * Height a card needs to show its whole title. Never smaller than the minimum card
 * height, so short titles keep the standard card and only long ones grow.
 */
export function cardHeightFor({ title, hasFooter, scale, measure }: FitInput): number {
  const lines = countLines(title, titleWidth(scale), measure)
  const content = (PAD_Y + BADGE_H + TITLE_GAP + lines * LINE_H + (hasFooter ? FOOTER_H : 0)) * scale
  return Math.max(CARD_H, Math.ceil(content + BORDER))
}
