import { describe, expect, it } from 'vitest'
import type { A4Doc, El, RectEl, TextEl } from './doc.types'
import { applyPatches, zShiftPatches } from './patch-apply'
import type { Patch } from './doc.types'

// Unit test thuần node cho engine patch-apply (ngoại lệ no-mock duy nhất theo AGENTS.md).
// Fixture tự dựng tại chỗ theo style hit-test.test.ts — KHÔNG import fixture file khác,
// không vi.mock. Object.freeze sâu chứng minh immutable (02-plan Bước 3 mục 3): mutate
// object đã freeze trong strict mode (ESM) sẽ throw → test chạy được = không có mutate.

/** Freeze đệ quy mọi nhánh object/array — chặn mutate ở bất kỳ tầng nào của input. */
const deepFreeze = <T>(o: T): T => {
  Object.freeze(o)
  for (const v of Object.values(o as Record<string, unknown>)) {
    if (v !== null && typeof v === 'object') deepFreeze(v)
  }
  return o
}

const doc = (elements: El[]): A4Doc => ({
  schemaVersion: 1,
  page: { w: 210, h: 297, unit: 'mm' },
  elements,
})

type TextOver = Partial<Omit<TextEl, 'props'>> & { props?: Partial<TextEl['props']> }
const text = (over: TextOver = {}): TextEl => ({
  id: 'E5',
  type: 'text',
  x: 8,
  y: 70,
  w: 194,
  h: 30,
  z: 5,
  ...over,
  props: {
    text: '15.000đ',
    font: 'price',
    fill: '#D32F2F',
    align: 'center',
    fitMode: 'shrink-to-fit',
    maxLines: 1,
    ...over.props,
  },
})

type RectOver = Partial<Omit<RectEl, 'props'>> & { props?: Partial<RectEl['props']> }
const rect = (over: RectOver = {}): RectEl => ({
  id: 'E1',
  type: 'rect',
  x: 0,
  y: 0,
  w: 210,
  h: 297,
  z: 1,
  ...over,
  props: { fill: '#FFF8F0', ...over.props },
})

// ─── applyPatches — op update ───

describe('applyPatches — update hợp lệ', () => {
  it('update props.text: doc mới + diff (field = path) + INPUT FROZEN nguyên vẹn', () => {
    const input = deepFreeze(doc([text({ id: 'E5' })]))
    const res = applyPatches(input, [{ op: 'update', id: 'E5', path: 'props.text', value: '25.000đ' }])
    expect(res.applied).toHaveLength(1)
    expect(res.skipped).toHaveLength(0)
    expect((res.doc.elements[0] as TextEl).props.text).toBe('25.000đ')
    expect(res.diffs).toEqual([{ id: 'E5', field: 'props.text', oldValue: '15.000đ', newValue: '25.000đ' }])
    expect((input.elements[0] as TextEl).props.text).toBe('15.000đ') // input không đổi
  })

  it('update x: element nhận x mới, mọi field khác giữ nguyên', () => {
    const input = deepFreeze(doc([text({ id: 'E5', x: 8 })]))
    const res = applyPatches(input, [{ op: 'update', id: 'E5', path: 'x', value: 12.5 }])
    const el = res.doc.elements[0] as TextEl
    expect(el.x).toBe(12.5)
    expect(el.y).toBe(70)
    expect(el.props.text).toBe('15.000đ')
  })

  it('update z: đổi z nguyên', () => {
    const res = applyPatches(doc([text({ id: 'E5', z: 5 })]), [{ op: 'update', id: 'E5', path: 'z', value: 9 }])
    expect((res.doc.elements[0] as TextEl).z).toBe(9)
    expect(res.diffs).toEqual([{ id: 'E5', field: 'z', oldValue: 5, newValue: 9 }])
  })

  it('chain 2 patch move (x+y) trong 1 lần áp: cả hai field đổi đủ', () => {
    const input = deepFreeze(doc([text({ id: 'E5', x: 8, y: 70 })]))
    const res = applyPatches(input, [
      { op: 'update', id: 'E5', path: 'x', value: 12.5 },
      { op: 'update', id: 'E5', path: 'y', value: 80 },
    ])
    expect(res.applied).toHaveLength(2)
    const el = res.doc.elements[0] as TextEl
    expect(el.x).toBe(12.5)
    expect(el.y).toBe(80)
    expect(res.diffs.map((d) => d.field)).toEqual(['x', 'y'])
  })

  it('copy-on-write: KHÔNG mutate input — mảng/element gốc giữ nguyên, output là doc mới', () => {
    const keep = text({ id: 'E9' })
    const input = doc([text({ id: 'E5' }), keep])
    const res = applyPatches(input, [{ op: 'update', id: 'E5', path: 'x', value: 10 }])
    expect(input.elements[1]).toBe(keep) // input nguyên vẹn
    expect(input.elements[0].x).toBe(8) // element gốc không đổi
    expect((res.doc.elements[0] as TextEl).x).toBe(10)
    expect(res.doc).not.toBe(input)
    expect(res.doc.elements).not.toBe(input.elements)
    // A4DocSchema.parse cuối hàm clone lại element → đối chiếu cấu trúc (không phải reference)
    expect(res.doc.elements[1]).toEqual(keep)
  })
})

// ─── applyPatches — op update bị skip ───

describe('applyPatches — update bị skip (layer 2/3)', () => {
  it("update id không tồn tại → skipped 'không tồn tại', KHÔNG retry", () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [{ op: 'update', id: 'E99', path: 'x', value: 10 }])
    expect(res.applied).toHaveLength(0)
    expect(res.skipped).toHaveLength(1)
    expect(res.skipped[0].reason).toContain("E99")
    expect(res.skipped[0].reason).toContain('không tồn tại')
  })

  it("path không hợp lệ cho type: props.text trên rect → skipped", () => {
    const res = applyPatches(doc([rect({ id: 'E1' })]), [{ op: 'update', id: 'E1', path: 'props.text', value: 'X' }])
    expect(res.skipped).toHaveLength(1)
    expect(res.skipped[0].reason).toContain('không hợp lệ cho type')
    expect(res.doc.elements[0]).toEqual(rect({ id: 'E1' }))
  })

  it('path ngoài tập hợp hợp lệ (foo) → skipped', () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [
      { op: 'update', id: 'E5', path: 'foo', value: 1 } as unknown as Patch,
    ])
    expect(res.skipped).toHaveLength(1)
  })

  it('value sai kiểu: x nhận chuỗi → skipped', () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [
      { op: 'update', id: 'E5', path: 'x', value: '10' },
    ])
    expect(res.skipped).toHaveLength(1)
    expect(res.skipped[0].reason).toContain('phải là số')
  })

  it('value sai kiểu: props.text nhận số → skipped', () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [
      { op: 'update', id: 'E5', path: 'props.text', value: 15 },
    ])
    expect(res.skipped).toHaveLength(1)
    expect(res.skipped[0].reason).toContain('phải là chuỗi')
  })

  it('fill sai HexColor (red) → skip kèm reason Zod', () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [
      { op: 'update', id: 'E5', path: 'props.fill', value: 'red' },
    ])
    expect(res.applied).toHaveLength(0)
    expect(res.skipped).toHaveLength(1)
    expect(res.skipped[0].reason).toContain('props.fill')
  })

  it('x = 350 vượt InPage [-5,302] → skip kèm reason Zod', () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [{ op: 'update', id: 'E5', path: 'x', value: 350 }])
    expect(res.skipped).toHaveLength(1)
    expect((res.doc.elements[0] as TextEl).x).toBe(8)
  })

  it('w = 0 vi phạm positive() → skip', () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [{ op: 'update', id: 'E5', path: 'w', value: 0 }])
    expect(res.skipped).toHaveLength(1)
  })

  it('z = 1.5 vi phạm int() → skip', () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [{ op: 'update', id: 'E5', path: 'z', value: 1.5 }])
    expect(res.skipped).toHaveLength(1)
    expect((res.doc.elements[0] as TextEl).z).toBe(5)
  })

  it("props.text rỗng vi phạm min(1) → skip", () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [
      { op: 'update', id: 'E5', path: 'props.text', value: '' },
    ])
    expect(res.skipped).toHaveLength(1)
  })
})

// ─── applyPatches — op remove / add / none ───

describe('applyPatches — remove / add / none', () => {
  it('remove id tồn tại: element mất khỏi doc, applied ghi nhận, KHÔNG sinh diff', () => {
    const input = deepFreeze(doc([rect({ id: 'E1' }), text({ id: 'E5' })]))
    const res = applyPatches(input, [{ op: 'remove', id: 'E5' }])
    expect(res.doc.elements.map((e) => e.id)).toEqual(['E1'])
    expect(res.applied).toEqual([{ op: 'remove', id: 'E5' }])
    expect(res.diffs).toEqual([])
    expect(input.elements).toHaveLength(2) // input nguyên vẹn
  })

  it('remove id không tồn tại → skipped', () => {
    const res = applyPatches(doc([text({ id: 'E5' })]), [{ op: 'remove', id: 'E6' }])
    expect(res.applied).toHaveLength(0)
    expect(res.skipped[0].reason).toContain('không tồn tại')
  })

  it('add KHÔNG after: element mới nối CUỐI mảng (thứ tự mảng gốc giữ nguyên)', () => {
    const added = rect({ id: 'E2', x: 10, y: 10, w: 30, h: 12, z: 2 })
    const res = applyPatches(doc([rect({ id: 'E1' })]), [{ op: 'add', id: 'E2', element: added }])
    expect(res.doc.elements.map((e) => e.id)).toEqual(['E1', 'E2'])
    expect(res.applied).toHaveLength(1)
  })

  it('add CÓ after: element mới chèn ngay SAU element after', () => {
    const added = rect({ id: 'E3', x: 10, y: 10, w: 30, h: 12, z: 2 })
    const res = applyPatches(doc([rect({ id: 'E1' }), rect({ id: 'E2' })]), [
      { op: 'add', id: 'E3', after: 'E1', element: added },
    ])
    expect(res.doc.elements.map((e) => e.id)).toEqual(['E1', 'E3', 'E2'])
  })

  it('add trùng id đã có → skipped', () => {
    const dup = rect({ id: 'E1', x: 5, y: 5, w: 10, h: 10, z: 1 })
    const res = applyPatches(doc([rect({ id: 'E1' })]), [{ op: 'add', id: 'E1', element: dup }])
    expect(res.applied).toHaveLength(0)
    expect(res.skipped[0].reason).toContain('đã tồn tại')
    expect(res.doc.elements).toHaveLength(1)
  })

  it('add element sai schema (fill hex sai) → skip kèm reason Zod', () => {
    const bad = rect({ id: 'E2', x: 10, y: 10, w: 30, h: 12, z: 2, props: { fill: 'xyz' } })
    const res = applyPatches(doc([rect({ id: 'E1' })]), [{ op: 'add', id: 'E2', element: bad }])
    expect(res.applied).toHaveLength(0)
    expect(res.skipped[0].reason).toContain('fill')
  })

  it("op none → no-op: ghi vào skipped với reason của patch, doc không đổi", () => {
    const input = deepFreeze(doc([text({ id: 'E5' })]))
    const res = applyPatches(input, [{ op: 'none', reason: 'Phần tử không hỗ trợ thao tác này' }])
    expect(res.applied).toHaveLength(0)
    expect(res.skipped).toEqual([{ patch: { op: 'none', reason: 'Phần tử không hỗ trợ thao tác này' }, reason: 'Phần tử không hỗ trợ thao tác này' }])
    expect(res.doc.elements).toHaveLength(1)
  })

  it('dãy patch LẪN áp/skip: op hợp lệ vẫn áp đủ, op sai bị bỏ (auto-apply một phần)', () => {
    const res = applyPatches(doc([text({ id: 'E5', x: 8, y: 70 })]), [
      { op: 'update', id: 'E5', path: 'x', value: 10 },
      { op: 'update', id: 'E99', path: 'x', value: 10 },
      { op: 'remove', id: 'E5' },
    ])
    expect(res.applied).toHaveLength(2)
    expect(res.skipped).toHaveLength(1)
    expect(res.doc.elements).toHaveLength(0)
  })
})

// ─── zShiftPatches ───

describe('zShiftPatches', () => {
  const d = doc([rect({ id: 'E1', z: 1 }), rect({ id: 'E2', z: 2 }), rect({ id: 'E3', z: 3 })])

  it('giữa mảng UP: hoán đổi z với kề trên (2 patch update z)', () => {
    expect(zShiftPatches(d, 'E2', 'up')).toEqual([
      { op: 'update', id: 'E2', path: 'z', value: 3 },
      { op: 'update', id: 'E3', path: 'z', value: 2 },
    ])
  })

  it('giữa mảng DOWN: hoán đổi z với kề dưới', () => {
    expect(zShiftPatches(d, 'E2', 'down')).toEqual([
      { op: 'update', id: 'E2', path: 'z', value: 1 },
      { op: 'update', id: 'E1', path: 'z', value: 2 },
    ])
  })

  it('áp patch trả về thực sự đổi thứ tự vẽ: E4 Tầng xuống chui dưới E3', () => {
    const demo = doc([
      rect({ id: 'E3', x: 48, y: 44, w: 114, h: 18, z: 3, props: { fill: '#FFF3CD' } }),
      text({ id: 'E4', x: 48, y: 44, w: 114, h: 18, z: 4 }),
    ])
    const res = applyPatches(demo, zShiftPatches(demo, 'E4', 'down'))
    expect(res.applied).toHaveLength(2)
    const paint = res.doc.elements.map((el) => el.id).sort((a, b) => {
      const za = res.doc.elements.find((e) => e.id === a)!.z
      const zb = res.doc.elements.find((e) => e.id === b)!.z
      return za - zb
    })
    expect(paint).toEqual(['E4', 'E3']) // E3 vẽ sau = đè E4
  })

  it('topmost UP → [] (UI disables nút)', () => {
    expect(zShiftPatches(d, 'E3', 'up')).toEqual([])
  })

  it('bottommost DOWN → []', () => {
    expect(zShiftPatches(d, 'E1', 'down')).toEqual([])
  })

  it('id không có trong doc → []', () => {
    expect(zShiftPatches(d, 'E99', 'up')).toEqual([])
  })

  it('cặp cùng z, UP → z = kề.z + 1 (1 patch — vượt kề thay vì hoán đổi no-op)', () => {
    const same = doc([rect({ id: 'E1', z: 1 }), rect({ id: 'E2', z: 1 }), rect({ id: 'E3', z: 2 })])
    expect(zShiftPatches(same, 'E1', 'up')).toEqual([{ op: 'update', id: 'E1', path: 'z', value: 2 }])
  })

  it('cặp cùng z, DOWN → z = kề.z − 1', () => {
    const same = doc([rect({ id: 'E1', z: 2 }), rect({ id: 'E2', z: 2 }), rect({ id: 'E3', z: 3 })])
    expect(zShiftPatches(same, 'E2', 'down')).toEqual([{ op: 'update', id: 'E2', path: 'z', value: 1 }])
  })

  it('kề dưới cùng z = 0, DOWN → [] (z ≥ 0 bắt buộc — doc.zod.ts:20)', () => {
    const zero = doc([rect({ id: 'E1', z: 0 }), rect({ id: 'E2', z: 0 })])
    expect(zShiftPatches(zero, 'E2', 'down')).toEqual([])
  })

  it('tie-break paint order theo index mảng: cùng z, element SAU được vẽ sau', () => {
    // [A(z1,idx0), B(z1,idx1)] — B 'up' không có kề trên (B đã trên cùng theo index)
    const pair = doc([rect({ id: 'E1', z: 1 }), rect({ id: 'E2', z: 1 })])
    expect(zShiftPatches(pair, 'E2', 'up')).toEqual([])
    // A 'up' → kề trên là B (cùng z) → z = 2
    expect(zShiftPatches(pair, 'E1', 'up')).toEqual([{ op: 'update', id: 'E1', path: 'z', value: 2 }])
  })
})
