import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { A4 } from './a4'
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
import { renderA4DocSvg } from './svg-render'

// Unit test thuần node cho engine (ngoại lệ no-mock duy nhất theo AGENTS.md —
// engine không chứa dữ liệu, không network). Style theo doc.types.test.ts:
// chỉ assert chuỗi SVG deterministic do renderA4DocSvg sinh ra.

// ─── Helper dựng fixture (schema-valid — renderA4DocSvg parse Zod trước khi vẽ) ───

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

/** Freeze đệ quy — chứng minh renderer chỉ ĐỌC doc (expand ảo không ghi đè). */
function deepFreeze(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
}

// ─── 12 nhóm assert theo 02-plan bước 2 ───

describe('svg-render — renderA4DocSvg (docs/ARCHITECTURE.md §7)', () => {
  it('(1) bọc đúng <svg xmlns viewBox="0 0 210 297"> theo hằng A4 — không hardcode', () => {
    const svg = renderA4DocSvg(doc([rect()]))
    expect(
      svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A4.w} ${A4.h}">`),
    ).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('(2) z-order: element z lớn vẽ SAU (nằm trên) dù đứng trước trong mảng input', () => {
    const onTop = rect({ id: 'E2', z: 2, props: { fill: '#212121' } })
    const atBottom = rect({ id: 'E1', z: 1, props: { fill: '#FFFFFF' } })
    const svg = renderA4DocSvg(doc([onTop, atBottom]))
    expect(svg.indexOf('fill="#FFFFFF"')).toBeLessThan(svg.indexOf('fill="#212121"'))
  })

  it('(3) sort bản sao — không đột biến mảng gốc; render 2 lần output giống hệt', () => {
    const d = doc([
      rect({ id: 'E2', z: 2, props: { fill: '#212121' } }),
      rect({ id: 'E1', z: 1, props: { fill: '#FFFFFF' } }),
    ])
    const out1 = renderA4DocSvg(d)
    const out2 = renderA4DocSvg(d)
    expect(out2).toBe(out1) // snapshot chuỗi — deterministic
    expect(d.elements.map((e) => e.id)).toEqual(['E2', 'E1']) // mảng gốc giữ nguyên thứ tự
  })

  it('(4) text: font stack theo token, fill nguyên trạng, align center → anchor giữa khung', () => {
    const svg = renderA4DocSvg(
      doc([text({ props: { text: 'Cà rốt', font: 'body', fill: '#2E7D32', align: 'center' } })]),
    )
    expect(svg).toContain(`font-family="'Be Vietnam Pro', system-ui, sans-serif"`)
    expect(svg).toContain('fill="#2E7D32"')
    expect(svg).toContain('text-anchor="middle"')
    expect(svg).toContain('x="40"') // anchor center: x=10 + w/2=30 → 40
  })

  it('(5) text dài → font-size nhỏ hơn text ngắn cùng khung (heuristic placeholder)', () => {
    const fs = (svg: string) => Number(svg.match(/font-size="([0-9.]+)"/)![1])
    const short = renderA4DocSvg(doc([text()]))
    const long = renderA4DocSvg(doc([text({ props: { text: 'Củ cải trắng siêu tươi ngon mỗi ngày' } })]))
    expect(fs(long)).toBeLessThan(fs(short))
  })

  it(`(6) escape XML: & < > " ' đều escape — không tag lạ chèn được`, () => {
    const svg = renderA4DocSvg(
      doc([text({ props: { text: `Rau & Củ "<b>a</b> 'siêu'` } })]),
    )
    expect(svg).toContain('&amp;')
    expect(svg).toContain('&lt;b&gt;a&lt;/b&gt;')
    expect(svg).toContain('&quot;')
    expect(svg).toContain('&apos;siêu&apos;')
    expect(svg).not.toContain('<b>')
    expect(svg).not.toContain('<script')
  })

  it('(7) rect có rx/stroke/stroke-width; line ngang khi w≥h, dọc khi h>w', () => {
    const svg = renderA4DocSvg(
      doc([
        rect({ props: { fill: '#FFFFFF', radius: 4, stroke: '#212121', strokeWidth: 0.5 } }),
        line(), // ngang: x=10 y=10 w=50 h=1
        line({ id: 'E2', x: 10, y: 40, w: 1, h: 30 }), // dọc
      ]),
    )
    expect(svg).toContain('rx="4"')
    expect(svg).toContain('stroke="#212121"')
    expect(svg).toContain('stroke-width="0.5"')
    expect(svg).toContain('x1="10" y1="10.5" x2="60" y2="10.5"') // ngang qua tâm đứng bbox
    expect(svg).toContain('x1="10.5" y1="40" x2="10.5" y2="70"') // dọc qua tâm ngang bbox
  })

  it('(8) image: rect #EEEEEE phía dưới <image>; cover→slice, contain→meet', () => {
    const cover = renderA4DocSvg(doc([image()]))
    const contain = renderA4DocSvg(doc([image({ props: { src: '/demo/x.svg', fit: 'contain' } })]))
    expect(cover).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(contain).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(cover.indexOf('fill="#EEEEEE"')).toBeLessThan(cover.indexOf('<image'))
  })

  it('(9) path: thuộc tính d nguyên trạng', () => {
    const svg = renderA4DocSvg(doc([path()]))
    expect(svg).toContain('d="M10 10 L20 20"')
  })

  it('(9b) path stroke-only (thiếu fill — hợp lệ Zod) → fill="none", không rơi default đen browser', () => {
    // Blocker 05-review vòng 1: path có stroke mà thiếu fill nếu xuất thẻ không attribute
    // fill thì browser áp default #000000 (ngoài palette in an toàn).
    const strokeOnly = renderA4DocSvg(doc([path()])) // fixture path(): stroke #2E7D32, không fill
    expect(strokeOnly).toContain('fill="none"')
    expect(strokeOnly).toContain('stroke="#2E7D32"')
    expect(strokeOnly).not.toContain('fill="#212121"') // không nhầm sang nhánh cả-hai-thiếu
    // Mọi thẻ <path> phải khai fill tường minh — không được để trống cho browser tự tô đen
    expect(strokeOnly).not.toMatch(/<path(?![^>]*fill=")[^>]*\/>/)
    // Nhánh "cả fill lẫn stroke đều thiếu" (Quyết định 7) vẫn giữ nguyên: mực #212121
    const bare = renderA4DocSvg(doc([{ ...path(), props: { d: 'M1 1 L2 2' } }]))
    expect(bare).toContain('fill="#212121"')
    expect(bare).toContain('d="M1 1 L2 2"')
  })

  it('(10) repeat: expand ảo cell đầu tại (el.x, el.y), giữ {{token}} literal, không ghi đè doc', () => {
    const rep = repeat()
    const svg = renderA4DocSvg(doc([rep]))
    expect(svg).toContain('{{name}}') // literal giữ nguyên — chưa có items[] (M3)
    expect(svg).toContain('{{price}}')
    expect(svg).toContain('x="8"') // text con x=0 + offset repeat.x=8 → render tại gốc repeat
    // Freeze sâu: nếu renderer ghi đè gì vào doc → TypeError trong strict mode
    const frozen = structuredClone(doc([rep]))
    deepFreeze(frozen)
    expect(() => renderA4DocSvg(frozen)).not.toThrow()
  })

  it('(11) rotation ≠ 0 → transform quay quanh đúng tâm bbox', () => {
    const svg = renderA4DocSvg(doc([rect({ x: 10, y: 10, w: 190, h: 277, rotation: 30 })]))
    expect(svg).toContain('transform="rotate(30, 105, 148.5)"') // cx=10+95, cy=10+138.5
  })

  it('(12) doc sai schema (thiếu field bắt buộc) → throw ZodError sớm', () => {
    const bad = {
      schemaVersion: 1,
      page: { w: 210, h: 297, unit: 'mm' },
      elements: [{ id: 'E1', type: 'rect', x: 1, y: 1, w: 2, h: 2, z: 1, props: {} }],
    }
    expect(() => renderA4DocSvg(bad as unknown as A4Doc)).toThrow(ZodError)
  })
})
