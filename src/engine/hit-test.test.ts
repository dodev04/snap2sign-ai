import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import type {
  A4Doc,
  El,
  ImageEl,
  LineEl,
  PathEl,
  RectEl,
  RepeatEl,
  TextEl,
} from './doc.types'
import { HIT_TOLERANCE_MM, elementAtPoint, hitTestElement, inverseRotate } from './hit-test'
import type { Pt } from './hit-test'

// Unit test thuần node cho engine hit-test (ngoại lệ no-mock duy nhất theo AGENTS.md —
// engine không chứa dữ liệu, không network; không vi.mock bất kỳ thứ gì).
// Fixture tự dựng tại chỗ theo style svg-render.test.ts — KHÔNG import fixture file khác.

// ─── Helper dựng fixture (schema-valid — elementAtPoint parse Zod trước khi test) ───

const doc = (elements: El[]): A4Doc => ({
  schemaVersion: 1,
  page: { w: 210, h: 297, unit: 'mm' },
  elements,
})

type TextOver = Partial<Omit<TextEl, 'props'>> & { props?: Partial<TextEl['props']> }
const text = (over: TextOver = {}): TextEl => ({
  id: 'E1',
  type: 'text',
  x: 10,
  y: 10,
  w: 60,
  h: 12,
  z: 1,
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

type LineOver = Partial<Omit<LineEl, 'props'>> & { props?: Partial<LineEl['props']> }
const line = (over: LineOver = {}): LineEl => ({
  id: 'E1',
  type: 'line',
  x: 10,
  y: 10,
  w: 50,
  h: 1,
  z: 1,
  ...over,
  props: { stroke: '#212121', strokeWidth: 0.5, ...over.props },
})

type ImageOver = Partial<Omit<ImageEl, 'props'>> & { props?: Partial<ImageEl['props']> }
const image = (over: ImageOver = {}): ImageEl => ({
  id: 'E1',
  type: 'image',
  x: 10,
  y: 10,
  w: 40,
  h: 40,
  z: 1,
  ...over,
  props: { src: '/demo/price-tag.svg', fit: 'cover', ...over.props },
})

type PathOver = Partial<Omit<PathEl, 'props'>> & { props?: Partial<PathEl['props']> }
const path = (over: PathOver = {}): PathEl => ({
  id: 'E1',
  type: 'path',
  x: 8,
  y: 10,
  w: 30,
  h: 20,
  z: 1,
  ...over,
  props: { d: 'M10 10 L20 20', stroke: '#2E7D32', ...over.props },
})

const repeat = (): RepeatEl => ({
  id: 'E9',
  type: 'repeat',
  x: 8,
  y: 176,
  w: 194,
  h: 88,
  z: 9,
  dataBinding: { source: 'items' },
  itemTemplate: {
    h: 30,
    elements: [
      {
        id: 'E91',
        type: 'text',
        x: 0,
        y: 2,
        w: 80,
        h: 10,
        z: 1,
        props: {
          text: '{{name}}',
          font: 'body',
          fill: '#212121',
          fitMode: 'shrink-to-fit',
          maxLines: 1,
        },
      },
      {
        id: 'E92',
        type: 'text',
        x: 0,
        y: 14,
        w: 80,
        h: 12,
        z: 2,
        props: {
          text: '{{price}}',
          font: 'price',
          fill: '#D32F2F',
          fitMode: 'shrink-to-fit',
          maxLines: 1,
        },
      },
    ],
  },
  grid: { cols: 2, gapX: 4, gapY: 4 },
  overflow: 'paginate',
})

/** Quay điểm TIẾN theo góc dương (cùng chiều SVG rotate) — chỉ dùng kiểm round-trip. */
const forwardRotate = (p: Pt, c: Pt, deg: number): Pt => {
  const rad = (deg * Math.PI) / 180
  const dx = p.x - c.x
  const dy = p.y - c.y
  return {
    x: c.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: c.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

// ─── Case 1: inverseRotate ───

describe('inverseRotate', () => {
  it('round-trip góc lệch 37.5° trả đúng điểm gốc (sai số < 1e-9)', () => {
    const center: Pt = { x: 12.3, y: -4.5 }
    const origin: Pt = { x: 88.7, y: 33.2 }
    const back = inverseRotate(forwardRotate(origin, center, 37.5), center, 37.5)
    expect(Math.abs(back.x - origin.x)).toBeLessThan(1e-9)
    expect(Math.abs(back.y - origin.y)).toBeLessThan(1e-9)
  })

  it('chốt hướng: inverseRotate({1,0}, gốc, 90) = (0,-1)', () => {
    const r = inverseRotate({ x: 1, y: 0 }, { x: 0, y: 0 }, 90)
    expect(r.x).toBeCloseTo(0, 9)
    expect(r.y).toBeCloseTo(-1, 9)
  })
})

// ─── Case 2-9: contains theo type ───

describe('elementAtPoint — contains bbox khai báo theo type', () => {
  it('rect: điểm trong bbox → id; ngoài → null', () => {
    const d = doc([rect({ id: 'E1', x: 40, y: 40, w: 20, h: 10 })])
    expect(elementAtPoint(d, { x: 50, y: 45 })).toBe('E1')
    expect(elementAtPoint(d, { x: 70, y: 45 })).toBeNull()
  })

  it('text: điểm trong bbox KHAI BÁO → id (không đo glyph); ngoài → null', () => {
    const d = doc([text({ id: 'E2', x: 8, y: 70, w: 194, h: 30 })])
    expect(elementAtPoint(d, { x: 100, y: 85 })).toBe('E2')
    expect(elementAtPoint(d, { x: 100, y: 120 })).toBeNull()
  })

  it(`line ngang (h=0.5): trên trục → id; lệch 4.9mm vẫn trúng (tolerance ±${HIT_TOLERANCE_MM}); lệch 5.6mm → null`, () => {
    // Line ngang bbox y∈[104,104.5] — trục line y = 104.25, nở ±5mm → y∈[99,109.5]
    const d = doc([line({ id: 'E6', x: 8, y: 104, w: 194, h: 0.5 })])
    expect(elementAtPoint(d, { x: 100, y: 104.25 })).toBe('E6')
    expect(elementAtPoint(d, { x: 100, y: 104.25 + 4.9 })).toBe('E6')
    expect(elementAtPoint(d, { x: 100, y: 104.25 + 5.6 })).toBeNull()
  })

  it('line dọc (h > w): tolerance theo trục còn lại', () => {
    // Line dọc x∈[100,100.5] — trục line x = 100.25
    const d = doc([line({ id: 'E7', x: 100, y: 20, w: 0.5, h: 60 })])
    expect(elementAtPoint(d, { x: 100.25, y: 50 })).toBe('E7')
    expect(elementAtPoint(d, { x: 100.25 + 4.9, y: 50 })).toBe('E7')
    expect(elementAtPoint(d, { x: 100.25 + 5.6, y: 50 })).toBeNull()
  })

  it('path: trong bbox khai báo → id (kể cả điểm KHÔNG nằm trên nét d); ngoài bbox → null', () => {
    // Nét chéo M8 136 L38 112 — điểm (20,118) trong bbox 8..38 / 112..136 nhưng cách nét ~8mm
    const d = doc([
      path({ id: 'E8', x: 8, y: 112, w: 30, h: 24, props: { d: 'M8 136 L38 112', stroke: '#2E7D32' } }),
    ])
    expect(elementAtPoint(d, { x: 20, y: 118 })).toBe('E8')
    expect(elementAtPoint(d, { x: 60, y: 118 })).toBeNull()
  })

  it('repeat: trong bbox repeat → id CHA; điểm rơi vào vùng con template vẫn id CHA, không bao giờ id con', () => {
    const d = doc([repeat()])
    // Trong bbox cha, ngoài vùng con
    expect(elementAtPoint(d, { x: 150, y: 220 })).toBe('E9')
    // Đúng vùng E92 (local 0,14,80,12 → trang 8..88 / 190..202)
    expect(elementAtPoint(d, { x: 40, y: 196 })).toBe('E9')
    // Đúng vùng E91 (local 0,2,80,10 → trang 8..88 / 178..188)
    expect(elementAtPoint(d, { x: 40, y: 183 })).toBe('E9')
  })

  it('image: trong bbox → id; ngoài → null', () => {
    const d = doc([image({ id: 'E8', x: 150, y: 112, w: 52, h: 52 })])
    expect(elementAtPoint(d, { x: 176, y: 138 })).toBe('E8')
    expect(elementAtPoint(d, { x: 176, y: 200 })).toBeNull()
  })
})

// ─── Case 10-11: thứ tự duyệt (z-order + tie-break cùng z) ───

describe('elementAtPoint — thứ tự duyệt z', () => {
  it('z-order: vùng chồng → element z cao; vùng chỉ rect dưới → z thấp', () => {
    const d = doc([
      rect({ id: 'E1', x: 10, y: 10, w: 100, h: 40, z: 1 }),
      rect({ id: 'E2', x: 40, y: 20, w: 30, h: 20, z: 5 }),
    ])
    expect(elementAtPoint(d, { x: 55, y: 30 })).toBe('E2')
    expect(elementAtPoint(d, { x: 15, y: 15 })).toBe('E1')
  })

  it('tie-break cùng z: 2 rect chồng nhau CÙNG z — điểm vùng chồng trả id element SAU trong mảng (vẽ sau = nằm trên)', () => {
    const d = doc([
      rect({ id: 'E1', x: 10, y: 10, w: 50, h: 50, z: 3 }),
      rect({ id: 'E2', x: 30, y: 30, w: 50, h: 50, z: 3 }),
    ])
    expect(elementAtPoint(d, { x: 40, y: 40 })).toBe('E2')
    expect(elementAtPoint(d, { x: 15, y: 15 })).toBe('E1')
  })
})

// ─── Case 12: rotation ───

describe('elementAtPoint / hitTestElement — rotation', () => {
  // rect {x:60,y:60,w:40,h:10,rotation:90} — tâm (80,65), hình xoay chiếm dải x∈[75,85], y∈[45,85]
  it('rotation 90°: điểm NGOÀI bbox khai báo nhưng TRÊN hình xoay → trúng; điểm TRONG bbox khai báo nhưng ngoài hình xoay → miss', () => {
    const el = rect({ id: 'E1', x: 60, y: 60, w: 40, h: 10, rotation: 90 })
    const d = doc([el])
    // (80,80): ngoài bbox khai báo (y>70) nhưng trên hình xoay
    expect(elementAtPoint(d, { x: 80, y: 80 })).toBe('E1')
    expect(hitTestElement(el, { x: 80, y: 80 })).toBe(true)
    // (65,65): trong bbox khai báo nhưng ngoài hình xoay
    expect(elementAtPoint(d, { x: 65, y: 65 })).toBeNull()
    expect(hitTestElement(el, { x: 65, y: 65 })).toBe(false)
  })

  it('rotation âm: -90 và -15 inverse-rotate đúng chiều', () => {
    // -90: cùng footprint x∈[75,85], y∈[45,85] như +90
    const neg90 = rect({ id: 'E1', x: 60, y: 60, w: 40, h: 10, rotation: -90 })
    expect(hitTestElement(neg90, { x: 80, y: 80 })).toBe(true)
    expect(hitTestElement(neg90, { x: 65, y: 65 })).toBe(false)
    // -15: điểm (63,74) ngoài bbox khai báo (y>70) nhưng trong hình xoay;
    //      điểm (100,60) trong bbox khai báo nhưng ngoài hình xoay
    const neg15 = rect({ id: 'E2', x: 60, y: 60, w: 40, h: 10, rotation: -15 })
    expect(hitTestElement(neg15, { x: 63, y: 74 })).toBe(true)
    expect(hitTestElement(neg15, { x: 100, y: 60 })).toBe(false)
  })

  it('rotation 0 / undefined: hành xử như không transform', () => {
    // Nếu phép quay (sai) chạy với 90° thì (80,80) sẽ trúng — 0/undefined phải miss
    const zero = rect({ id: 'E3', x: 60, y: 60, w: 40, h: 10, rotation: 0 })
    expect(hitTestElement(zero, { x: 80, y: 80 })).toBe(false)
    const noRot = rect({ id: 'E4', x: 60, y: 60, w: 40, h: 10 })
    expect(hitTestElement(noRot, { x: 80, y: 80 })).toBe(false)
    expect(hitTestElement(noRot, { x: 80, y: 65 })).toBe(true)
  })
})

// ─── Case 13-15: biên ngoài, schema, biên inclusive ───

describe('elementAtPoint — biên và schema', () => {
  it('điểm ngoài trang (-10,-10) và (250,300) → null khi không element phủ', () => {
    const d = doc([rect({ id: 'E1', x: 10, y: 10, w: 30, h: 20 })])
    expect(elementAtPoint(d, { x: -10, y: -10 })).toBeNull()
    expect(elementAtPoint(d, { x: 250, y: 300 })).toBeNull()
  })

  it('doc sai schema → elementAtPoint throw ZodError (đối xứng renderA4DocSvg)', () => {
    const bad = {
      schemaVersion: 2,
      page: { w: 210, h: 297, unit: 'mm' },
      elements: [],
    } as unknown as A4Doc
    expect(() => elementAtPoint(bad, { x: 10, y: 10 })).toThrow(ZodError)
  })

  it('biên inclusive: điểm đúng mép bbox (x = el.x, x = el.x+w, y = el.y, y = el.y+h) → trúng', () => {
    const d = doc([rect({ id: 'E1', x: 40, y: 40, w: 20, h: 10 })])
    expect(elementAtPoint(d, { x: 40, y: 45 })).toBe('E1')
    expect(elementAtPoint(d, { x: 60, y: 45 })).toBe('E1')
    expect(elementAtPoint(d, { x: 50, y: 40 })).toBe('E1')
    expect(elementAtPoint(d, { x: 50, y: 50 })).toBe('E1')
  })
})
