import type { Card } from '../types'
import { cardHeightFor, type Measure } from '../board/textFit'

let canvas: HTMLCanvasElement | null = null
const widthCache = new Map<string, number>()

/** Real text widths from a canvas, falling back to a character estimate where there is no canvas. */
function makeMeasure(scale: number): Measure {
  const px = 12 * scale
  let family = ''
  try {
    family = getComputedStyle(document.body).fontFamily
  } catch {
    /* no DOM */
  }
  const font = `600 ${px}px ${family || 'system-ui, sans-serif'}`
  let ctx: CanvasRenderingContext2D | null = null
  try {
    canvas ??= document.createElement('canvas')
    ctx = canvas.getContext('2d')
  } catch {
    ctx = null
  }
  return (text) => {
    if (!ctx) return text.length * px * 0.56
    const key = `${font}|${text}`
    const hit = widthCache.get(key)
    if (hit !== undefined) return hit
    ctx.font = font
    const w = ctx.measureText(text).width
    if (widthCache.size > 5000) widthCache.clear()
    widthCache.set(key, w)
    return w
  }
}

/** Whether a card shows the owner / estimate / indicator row under its title. */
export function cardHasFooter(card: Card): boolean {
  return Boolean(
    card.owner || card.party || card.estimate !== undefined || card.description?.trim() || card.hasContent || (card.attachments?.length ?? 0) > 0,
  )
}

/** Height of every card at the given text scale: the minimum card, or taller when the title needs it. */
export function cardHeights(cards: Card[], scale: number): (card: Card) => number {
  const measure = makeMeasure(scale)
  const byId = new Map<string, number>()
  for (const c of cards) byId.set(c.id, cardHeightFor({ title: c.title, hasFooter: cardHasFooter(c), scale, measure }))
  return (c) => byId.get(c.id) ?? 0
}
