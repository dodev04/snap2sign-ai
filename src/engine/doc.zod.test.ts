import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import type { A4Doc } from './doc.types'
import {
  A4DocSchema,
  BatchResult,
  ElementBase,
  ExtractResult,
  HexColor,
  InPage,
  Patch,
  TagResult,
  TextProps,
} from './doc.zod'

// Unit test thuần schema cho engine (ngoại lệ no-mock theo AGENTS.md) — không network,
// không dữ liệu: positive/negative assertions cho từng schema mirror từ
// docs/SYSTEM_PROMPTS.md §6 (dòng 314-379) + A4DocSchema tổng hợp từ ARCHITECTURE §3.

describe('HexColor (SYSTEM_PROMPTS §6 dòng 316)', () => {
  it('hex 6 ký tự pass; 3 ký tự / tên màu / ký tự ngoài hex fail', () => {
    expect(HexColor.safeParse('#D32F2F').success).toBe(true)
    expect(HexColor.safeParse('#FFF').success).toBe(false)
    expect(HexColor.safeParse('red').success).toBe(false)
    expect(HexColor.safeParse('#GGGGGG').success).toBe(false)
  })
})

describe('InPage (SYSTEM_PROMPTS §6 dòng 317)', () => {
  it('biên -5/0/302 pass; lệch biên -5.01/302.01 fail', () => {
    expect(InPage.safeParse(-5).success).toBe(true)
    expect(InPage.safeParse(0).success).toBe(true)
    expect(InPage.safeParse(302).success).toBe(true)
    expect(InPage.safeParse(-5.01).success).toBe(false)
    expect(InPage.safeParse(302.01).success).toBe(false)
  })
})

describe('ElementBase (SYSTEM_PROMPTS §6 dòng 319-325)', () => {
  const baseOk = { id: 'E01', x: 10, y: 10, w: 50, h: 20, z: 0 }

  it('id sau re-id client: E01 pass; e1 thường và E 5 chữ số fail', () => {
    expect(ElementBase.safeParse(baseOk).success).toBe(true)
    expect(ElementBase.safeParse({ ...baseOk, id: 'e1' }).success).toBe(false)
    expect(ElementBase.safeParse({ ...baseOk, id: 'E12345' }).success).toBe(false)
  })

  it('w positive().max(215): 0 và 216 fail', () => {
    expect(ElementBase.safeParse({ ...baseOk, w: 0 }).success).toBe(false)
    expect(ElementBase.safeParse({ ...baseOk, w: 216 }).success).toBe(false)
  })

  it('z int().nonnegative(): -1 và 1.5 fail', () => {
    expect(ElementBase.safeParse({ ...baseOk, z: -1 }).success).toBe(false)
    expect(ElementBase.safeParse({ ...baseOk, z: 1.5 }).success).toBe(false)
  })

  it('dataBinding 预留 chỉ nhận null — object binding fail', () => {
    expect(ElementBase.safeParse({ ...baseOk, dataBinding: null }).success).toBe(true)
    expect(ElementBase.safeParse({ ...baseOk, dataBinding: { source: 'items' } }).success).toBe(false)
  })
})

describe('TextProps (SYSTEM_PROMPTS §6 dòng 327-335)', () => {
  const textOk = { text: 'Cà phê sữa 15K', font: 'price', fill: '#D32F2F', fitMode: 'wrap', maxLines: 3 }

  it('đủ field pass; weight 400 pass, 500 fail (chỉ 400|700|900)', () => {
    expect(TextProps.safeParse(textOk).success).toBe(true)
    expect(TextProps.safeParse({ ...textOk, weight: 400 }).success).toBe(true)
    expect(TextProps.safeParse({ ...textOk, weight: 500 }).success).toBe(false)
  })

  it('text rỗng fail; font ngoài enum fail; maxLines 0/7 fail (1..6)', () => {
    expect(TextProps.safeParse({ ...textOk, text: '' }).success).toBe(false)
    expect(TextProps.safeParse({ ...textOk, font: 'arial' }).success).toBe(false)
    expect(TextProps.safeParse({ ...textOk, maxLines: 0 }).success).toBe(false)
    expect(TextProps.safeParse({ ...textOk, maxLines: 7 }).success).toBe(false)
  })
})

describe('Patch — op update (SYSTEM_PROMPTS §6 dòng 337-343)', () => {
  it("path 'props.fill'/'x' hợp lệ pass; 'foo'/'props.foo' fail", () => {
    expect(Patch.safeParse({ op: 'update', id: 'E01', path: 'props.fill', valueStr: '#FF0000' }).success).toBe(true)
    expect(Patch.safeParse({ op: 'update', id: 'E01', path: 'x', valueNum: 12 }).success).toBe(true)
    expect(Patch.safeParse({ op: 'update', id: 'E01', path: 'foo', valueStr: 'a' }).success).toBe(false)
    expect(Patch.safeParse({ op: 'update', id: 'E01', path: 'props.foo', valueStr: 'a' }).success).toBe(false)
  })

  it('refine đúng-1: điền 2 hoặc 0 trong valueStr/valueNum/valueBool fail', () => {
    expect(Patch.safeParse({ op: 'update', id: 'E01', path: 'x', valueStr: 'a', valueNum: 1 }).success).toBe(false)
    expect(Patch.safeParse({ op: 'update', id: 'E01', path: 'x' }).success).toBe(false)
  })
})

describe('Patch — op add: superRefine theo type (hiện thực comment §6 dòng 344-345, bám props ARCHITECTURE §3)', () => {
  const addBase = { id: 'E09', x: 10, y: 40, w: 80, h: 12, z: 3 }
  const add = (element: Record<string, unknown>) => ({ op: 'add', id: 'E09', element: { ...addBase, ...element } })

  it('đủ field theo từng loại: text/rect/line/image/path đều pass', () => {
    expect(Patch.safeParse(add({ type: 'text', text: 'Khuyến mãi', font: 'display', fill: '#000000', fitMode: 'shrink-to-fit', maxLines: 1 })).success).toBe(true)
    expect(Patch.safeParse(add({ type: 'rect', fill: '#FFFFFF' })).success).toBe(true)
    expect(Patch.safeParse(add({ type: 'line', stroke: '#000000', strokeWidth: 0.5 })).success).toBe(true)
    expect(Patch.safeParse(add({ type: 'image', src: 'photos/abc.jpg' })).success).toBe(true)
    expect(Patch.safeParse(add({ type: 'path', d: 'M 0 0 L 10 10' })).success).toBe(true)
  })

  it('thiếu field bắt buộc theo loại: text thiếu font, rect thiếu fill, line thiếu strokeWidth, image thiếu src, path thiếu d — đều fail', () => {
    expect(Patch.safeParse(add({ type: 'text', text: 'Khuyến mãi', fill: '#000000', fitMode: 'wrap', maxLines: 2 })).success).toBe(false)
    expect(Patch.safeParse(add({ type: 'rect' })).success).toBe(false)
    expect(Patch.safeParse(add({ type: 'line', stroke: '#000000' })).success).toBe(false)
    expect(Patch.safeParse(add({ type: 'image' })).success).toBe(false)
    expect(Patch.safeParse(add({ type: 'path' })).success).toBe(false)
  })

  it("type 'repeat' fail — AI không sinh repeat (responseSchema §1/§2 chỉ 5 loại)", () => {
    expect(Patch.safeParse(add({ type: 'repeat', dataBinding: { source: 'items' } })).success).toBe(false)
  })
})

describe('Patch — op remove/none (SYSTEM_PROMPTS §6 dòng 346-347)', () => {
  it('remove pass với id; none đòi reason ≥ 3 ký tự', () => {
    expect(Patch.safeParse({ op: 'remove', id: 'E01' }).success).toBe(true)
    expect(Patch.safeParse({ op: 'none', reason: 'ab' }).success).toBe(false)
    expect(Patch.safeParse({ op: 'none', reason: 'Không tìm thấy phần tử này' }).success).toBe(true)
  })
})

describe('ExtractResult (SYSTEM_PROMPTS §6 dòng 350-366)', () => {
  const elOk = (i: number) => ({ id: `e${i}`, type: 'rect', x: 0, y: 0, w: 10, h: 10, confidence: 0.9 })
  const resultOk = (n: number) => ({ page: { w: 210, h: 297 }, elements: Array.from({ length: n }, (_, i) => elOk(i + 1)) })

  it('60 elements pass; 61 fail (max 60)', () => {
    expect(ExtractResult.safeParse(resultOk(60)).success).toBe(true)
    expect(ExtractResult.safeParse(resultOk(61)).success).toBe(false)
  })

  it('page w khác 210 fail', () => {
    expect(ExtractResult.safeParse({ ...resultOk(1), page: { w: 211, h: 297 } }).success).toBe(false)
  })

  it("id 'e1' pass — EXTRACT chưa re-id nên z.string() tự do (SYSTEM_PROMPTS dòng 105)", () => {
    expect(ExtractResult.safeParse(resultOk(1)).success).toBe(true)
  })

  it('confidence ngoài [0,1] hoặc thiếu fail', () => {
    expect(ExtractResult.safeParse({ page: { w: 210, h: 297 }, elements: [{ ...elOk(1), confidence: 1.5 }] }).success).toBe(false)
    const elNoConfidence = { id: 'e1', type: 'rect', x: 0, y: 0, w: 10, h: 10 }
    expect(ExtractResult.safeParse({ page: { w: 210, h: 297 }, elements: [elNoConfidence] }).success).toBe(false)
  })
})

describe('BatchResult (SYSTEM_PROMPTS §6 dòng 368-374)', () => {
  const itemOk = { name: 'Cà phê', price: 15000, unit: 'ly', discount: null, confidence: 0.9 }

  it('item hợp lệ pass; discount null pass (không giảm giá)', () => {
    expect(BatchResult.safeParse({ items: [itemOk] }).success).toBe(true)
    expect(BatchResult.safeParse({ items: [{ ...itemOk, discount: 5 }] }).success).toBe(true)
  })

  it('items rỗng fail; price 15.5 fail (int); discount 0/100 fail; name rỗng fail', () => {
    expect(BatchResult.safeParse({ items: [] }).success).toBe(false)
    expect(BatchResult.safeParse({ items: [{ ...itemOk, price: 15.5 }] }).success).toBe(false)
    expect(BatchResult.safeParse({ items: [{ ...itemOk, discount: 0 }] }).success).toBe(false)
    expect(BatchResult.safeParse({ items: [{ ...itemOk, discount: 100 }] }).success).toBe(false)
    expect(BatchResult.safeParse({ items: [{ ...itemOk, name: '' }] }).success).toBe(false)
  })
})

describe('TagResult (SYSTEM_PROMPTS §6 dòng 376-379)', () => {
  const tagOk = { name: 'Bảng giá tạp hóa', description: 'Bảng giá siết chữ to rõ cho hàng tạp hóa', tags: ['giá', 'tạp hóa', 'chữ to'] }

  it('hợp lệ pass; name 2 ký tự fail; tags 2 phần tử fail', () => {
    expect(TagResult.safeParse(tagOk).success).toBe(true)
    expect(TagResult.safeParse({ ...tagOk, name: 'Ba' }).success).toBe(false)
    expect(TagResult.safeParse({ ...tagOk, tags: ['giá', 'tạp hóa'] }).success).toBe(false)
  })

  it('tags 7 phần tử pass — mirror nguyên văn max 7 dù prompt §5 nói 3-6 (+1 ngoài danh sách)', () => {
    expect(TagResult.safeParse({ ...tagOk, tags: ['1', '2', '3', '4', '5', '6', '7'] }).success).toBe(true)
  })
})

describe('A4DocSchema + ElSchema (tổng hợp cơ học từ ARCHITECTURE §3 — 02-plan Bước 5)', () => {
  const textEl = { id: 'E01', type: 'text', x: 10, y: 10, w: 80, h: 12, z: 0,
    props: { text: 'SIÊU THỊ ABC', font: 'display', weight: 900, fill: '#000000', align: 'left', fitMode: 'shrink-to-fit', maxLines: 1 } }
  const rectEl = { id: 'E02', type: 'rect', x: 5, y: 5, w: 200, h: 287, z: 1,
    props: { fill: '#FFFFFF', radius: 2, stroke: '#000000', strokeWidth: 0.5 } }
  const lineEl = { id: 'E03', type: 'line', x: 10, y: 30, w: 190, h: 0.5, z: 2,
    props: { stroke: '#333333', strokeWidth: 0.5 } }
  const imageEl = { id: 'E04', type: 'image', x: 150, y: 250, w: 50, h: 40, z: 3,
    props: { src: 'photos/logo.png', fit: 'cover' } }
  const pathEl = { id: 'E05', type: 'path', x: 0, y: 280, w: 210, h: 10, z: 4,
    props: { d: 'M 0 0 L 210 0' } }
  const repeatText = { id: 'E07', type: 'text', x: 0, y: 0, w: 180, h: 10, z: 0,
    props: { text: '{{name}} — {{price}}đ', font: 'body', fill: '#111111', fitMode: 'wrap', maxLines: 2 } }
  const repeatEl = { id: 'E06', type: 'repeat', x: 8, y: 60, w: 194, h: 200, z: 5,
    dataBinding: { source: 'items' },
    itemTemplate: { h: 30, elements: [repeatText] },
    grid: { cols: 2, gapX: 4, gapY: 6 },
    overflow: 'paginate' }

  const docOk = { schemaVersion: 1, page: { w: 210, h: 297, unit: 'mm' },
    elements: [textEl, rectEl, lineEl, imageEl, pathEl, repeatEl] }

  it('doc hợp lệ chứa đủ 6 loại element (repeat có itemTemplate chứa text + grid + overflow) pass', () => {
    expect(A4DocSchema.safeParse(docOk).success).toBe(true)
  })

  it('schemaVersion 2 fail; unit px fail', () => {
    expect(A4DocSchema.safeParse({ ...docOk, schemaVersion: 2 }).success).toBe(false)
    expect(A4DocSchema.safeParse({ ...docOk, page: { w: 210, h: 297, unit: 'px' } }).success).toBe(false)
  })

  it('element thiếu z fail; id chưa re-id fail; text thiếu fitMode fail', () => {
    const textNoZ = { id: 'E01', type: 'text', x: 10, y: 10, w: 80, h: 12,
      props: { text: 'SIÊU THỊ ABC', font: 'display', weight: 900, fill: '#000000', align: 'left', fitMode: 'shrink-to-fit', maxLines: 1 } }
    expect(A4DocSchema.safeParse({ ...docOk, elements: [textNoZ] }).success).toBe(false)
    expect(A4DocSchema.safeParse({ ...docOk, elements: [{ ...textEl, id: 'e1' }] }).success).toBe(false)
    const textNoFit = { ...textEl, props: { text: 'SIÊU THỊ ABC', font: 'display', weight: 900, fill: '#000000', align: 'left', maxLines: 1 } }
    expect(A4DocSchema.safeParse({ ...docOk, elements: [textNoFit] }).success).toBe(false)
  })

  it('repeat lồng trong itemTemplate.elements hợp lệ pass — chứng minh z.lazy đệ quy chạy', () => {
    const nestedRepeat = { ...repeatEl, id: 'E08',
      itemTemplate: { h: 10, elements: [{ ...repeatEl, id: 'E09', itemTemplate: { h: 30, elements: [repeatText] } }] } }
    expect(A4DocSchema.safeParse({ ...docOk, elements: [nestedRepeat] }).success).toBe(true)
  })

  it('z.infer<typeof A4DocSchema> ≡ A4Doc — schema Zod và TS types không lệch nhau', () => {
    expectTypeOf<z.infer<typeof A4DocSchema>>().toEqualTypeOf<A4Doc>()
  })
})
