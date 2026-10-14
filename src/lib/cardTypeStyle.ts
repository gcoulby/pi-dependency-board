import {
  Layers, Wrench, FlaskConical, Hammer, ShieldAlert, Flag, Rocket, Bug,
  Zap, Package, Target, Users, Cloud, Database, Puzzle, Star,
  type LucideIcon,
} from 'lucide-react'
import type { CardTypeIcon } from '../types'

const HEX = /^#[0-9a-fA-F]{6}$/

export function isValidHex(hex: string): boolean {
  return HEX.test(hex)
}

/** Returns a valid `#rrggbb`, or the fallback when the input is anything else. */
export function safeHex(hex: string | undefined, fallback = '#8b949e'): string {
  return hex && HEX.test(hex) ? hex.toLowerCase() : fallback
}

/**
 * Tailwind cannot generate classes from user-chosen colours, so derive inline
 * styles from the stored hex. Only valid for six-digit `#rrggbb`.
 */
export function cardTypeStyle(hex: string) {
  const h = safeHex(hex)
  return {
    bar: h,
    bg: `${h}1f`, // roughly 12% alpha
    border: `${h}59`, // roughly 35% alpha
    // Keeps the full colour in dark mode and darkens it in light mode, so text stays legible on white
    text: `color-mix(in srgb, ${h} var(--type-mix, 100%), #000)`,
  }
}

/** The single lookup from stored string key to component. Never put components in state or the file. */
export const CARD_TYPE_ICONS: Record<CardTypeIcon, LucideIcon> = {
  Layers, Wrench, FlaskConical, Hammer, ShieldAlert, Flag, Rocket, Bug,
  Zap, Package, Target, Users, Cloud, Database, Puzzle, Star,
}

export const ALL_CARD_TYPE_ICONS = Object.keys(CARD_TYPE_ICONS) as CardTypeIcon[]

export function cardTypeIcon(key: string | undefined): LucideIcon {
  return (key && CARD_TYPE_ICONS[key as CardTypeIcon]) || Layers
}
