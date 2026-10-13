import { describe, expect, it } from 'vitest'
import { pickSides } from './edgeRoute'

describe('pickSides', () => {
  it('goes bottom to top when the target is below', () => {
    expect(pickSides({ x: 0, y: 0, h: 84 }, { x: 500, y: 200, h: 84 })).toEqual({ source: 'bottom', target: 'top' })
  })
  it('goes top to bottom when the target is above', () => {
    expect(pickSides({ x: 0, y: 300, h: 84 }, { x: 500, y: 0, h: 84 })).toEqual({ source: 'top', target: 'bottom' })
  })
  it('joins sides only when the cards overlap vertically', () => {
    expect(pickSides({ x: 0, y: 0, h: 84 }, { x: 500, y: 40, h: 84 })).toEqual({ source: 'right', target: 'left' })
    expect(pickSides({ x: 500, y: 0, h: 84 }, { x: 0, y: 40, h: 84 })).toEqual({ source: 'left', target: 'right' })
  })
  it('treats touching cards as stacked', () => {
    expect(pickSides({ x: 0, y: 0, h: 84 }, { x: 0, y: 84, h: 84 }).source).toBe('bottom')
  })
})
