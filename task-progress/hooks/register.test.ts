import { test, expect } from 'claude-code/testing'
import { colorFor } from './register'

test('cor avança do vermelho ao verde', () => {
  expect(colorFor(0)).toBe('#ef4444')
  expect(colorFor(0.5)).toBe('#eab308')
  expect(colorFor(1)).toBe('#22c55e')
})
