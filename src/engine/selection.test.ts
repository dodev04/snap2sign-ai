import { describe, expect, it } from 'vitest'
import type { A4Doc, El, RectEl, TextEl } from './doc.types'
import { isBackgroundElement, selectableElementAtPoint } from './selection'

// Unit test thuần node cho engine selection (ngoại lệ no-mock duy nhất theo AGENTS.md).
// Fixture tự dựng tại chỗ theo style hit-test.test.ts — KHÔNG import fixture file khác.

const page = { w: 210, h: 297 }
const doc = (elements: El[]): A4Doc => ({
  schemaVersion: 1,
  page: { w: 210, h: 297, unit: 'mm' },
  elements,
})

type RectOver = Partial<Omit<RectEl, 'props'>> & { props?: Partial<RectEl['props']> }
const rect = (over: RectOver = {}): RectEl => ({
  id: 'E1',
  type: 'rect',
  x: 10,
  y: 10,
  w: 40,
  h: 20,
  z: 1,
  ...over,
  props: { fill: '#FFFFFF', ...over.props },
})

type TextOver = Partial<Omit<TextEl, 'props'>> & { props?: Partial<TextEl['props']> }
const text = (over: TextOver = {}): TextEl => ({
  id: 'E2',
  type: 'text',
  x: 10,
  y: 10,
  w: 60,
  h: 12,
  z: 2,
  ...over,
  props: {
    text: 'Cà rốt',
    font: 'body',
    fill: '#212121',
    fitMode: 'shrink-to-fit',
    maxLines: 1,
    ...over.props,
  },
})

// ─── isBackgroundElement — định nghĩa nền STATIC_PREFIX dòng 20 ───

describe('isBackgroundElement', () => {
  it('rect (0,0,210,297) đúng khổ trang → là nền', () => {
    expect(isBackgroundElement(rect({ x: 0, y: 0, w: 210, h: 297 }), page)).toBe(true)
  })

  it('rect (-2,0,212,297) tràn mép nhưng vẫn phủ kín → là nền', () => {
    expect(isBackgroundElement(rect({ x: -2, y: 0, w: 212, h: 297 }), page)).toBe(true)
  })

  it('rect (0,0,209,297) hẹp hơn trang 1mm → KHÔNG phải nền', () => {
    expect(isBackgroundElement(rect({ x: 0, y: 0, w: 209, h: 297 }), page)).toBe(false)
  })

  it('rect (0,0,210,296) thấp hơn trang 1mm → KHÔNG phải nền', () => {
    expect(isBackgroundElement(rect({ x: 0, y: 0, w: 210, h: 296 }), page)).toBe(false)
  })

  it('rect (1,0,210,297) lệch x>0 (để hở mép tây) → KHÔNG phải nền', () => {
    expect(isBackgroundElement(rect({ x: 1, y: 0, w: 210, h: 297 }), page)).toBe(false)
  })

  it('text full-page → KHÔNG phải nền (sai type)', () => {
    expect(isBackgroundElement(text({ x: 0, y: 0, w: 210, h: 297 }), page)).toBe(false)
  })

  it('rect full-page xoay 5° → KHÔNG phải nền (rotation ≠ 0)', () => {
    expect(isBackgroundElement(rect({ x: 0, y: 0, w: 210, h: 297, rotation: 5 }), page)).toBe(false)
  })

  it('rect full-page rotation: 0 → vẫn là nền (0 === undefined về hiệu ứng)', () => {
    expect(isBackgroundElement(rect({ x: 0, y: 0, w: 210, h: 297, rotation: 0 }), page)).toBe(true)
  })
})

// ─── selectableElementAtPoint — click nền = deselect (Quyết định 1B) ───

describe('selectableElementAtPoint', () => {
  // Doc kiểu demo-doc: nền E1 + băng E3 bị chữ E4 chồng đúng bbox + giá E5
  const d = doc([
    rect({ id: 'E1', x: 0, y: 0, w: 210, h: 297, z: 1, props: { fill: '#FFF8F0' } }),
    rect({ id: 'E3', x: 48, y: 44, w: 114, h: 18, z: 3, props: { fill: '#FFF3CD' } }),
    text({
      id: 'E4',
      x: 48,
      y: 44,
      w: 114,
      h: 18,
      z: 4,
      props: { text: 'GIẢM 30%', font: 'price', fill: '#D32F2F', align: 'center' },
    }),
    text({
      id: 'E5',
      x: 8,
      y: 70,
      w: 194,
      h: 30,
      z: 5,
      props: { text: '15.000đ', font: 'price', fill: '#D32F2F', align: 'center' },
    }),
  ])

  it('điểm vùng trống (chỉ nền E1 phủ) → null = deselect (1B)', () => {
    expect(selectableElementAtPoint(d, { x: 100, y: 130 })).toBeNull()
  })

  it('điểm giữa E4 → E4 (E4 chồng E3 cùng bbox, z cao hơn)', () => {
    expect(selectableElementAtPoint(d, { x: 105, y: 53 })).toBe('E4')
  })

  it('điểm giữa E5 → E5', () => {
    expect(selectableElementAtPoint(d, { x: 100, y: 85 })).toBe('E5')
  })

  it('điểm ngoài tờ (250, 300) → null', () => {
    expect(selectableElementAtPoint(d, { x: 250, y: 300 })).toBeNull()
  })
})
