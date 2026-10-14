import { describe, expect, it } from 'vitest'
import { CARD_H } from './constants'
import { cardHeightFor, countLines, titleWidth } from './textFit'

// 6px per character keeps the arithmetic obvious
const measure = (s: string) => s.length * 6

describe('countLines', () => {
  it('is one line for short or empty text', () => {
    expect(countLines('', 100, measure)).toBe(1)
    expect(countLines('hello world', 100, measure)).toBe(1)
  })
  it('wraps at spaces', () => {
    // 100px fits 16 chars: "aaaa bbbb cccc" = 14 fits, adding " dddd" = 19 does not
    expect(countLines('aaaa bbbb cccc dddd', 100, measure)).toBe(2)
  })
  it('breaks a word wider than the line', () => {
    expect(countLines('x'.repeat(40), 60, measure)).toBe(4) // 10 chars per line
  })
  it('counts every wrapped line of a long sentence', () => {
    const text = Array.from({ length: 30 }, () => 'word').join(' ')
    expect(countLines(text, 100, measure)).toBeGreaterThan(5)
  })
})

describe('cardHeightFor', () => {
  const base = { hasFooter: true, scale: 1, measure }

  it('keeps the minimum card height for short titles', () => {
    expect(cardHeightFor({ ...base, title: 'Short' })).toBe(CARD_H)
    expect(cardHeightFor({ ...base, title: 'Two lines here ' + 'x'.repeat(20) })).toBeGreaterThanOrEqual(CARD_H)
  })

  it('grows once the title needs more lines than fit', () => {
    const long = Array.from({ length: 40 }, () => 'word').join(' ')
    expect(cardHeightFor({ ...base, title: long })).toBeGreaterThan(CARD_H)
  })

  it('grows with the text scale', () => {
    const title = Array.from({ length: 12 }, () => 'word').join(' ')
    const small = cardHeightFor({ ...base, title, scale: 1, measure })
    const big = cardHeightFor({ ...base, title, scale: 1.5, measure: (s) => measure(s) * 1.5 })
    expect(big).toBeGreaterThan(small)
  })

  it('is a little shorter without a footer row', () => {
    const long = Array.from({ length: 40 }, () => 'word').join(' ')
    expect(cardHeightFor({ ...base, title: long, hasFooter: false })).toBeLessThan(cardHeightFor({ ...base, title: long }))
  })

  it('narrows the title area as text scale grows', () => {
    expect(titleWidth(1.5)).toBeLessThan(titleWidth(1))
  })
})
