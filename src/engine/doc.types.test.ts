import { describe, expect, expectTypeOf, it } from 'vitest'
import { A4 } from './a4'
import type {
  A4Doc,
  BaseEl,
  El,
  ElType,
  ImageEl,
  LineEl,
  Patch,
  PathEl,
  RectEl,
  RepeatEl,
  TextEl,
} from './doc.types'

// Unit test thuần type-level cho engine (ngoại lệ no-mock theo AGENTS.md) — không network,
// không dữ liệu: chỉ assert TS types nguyên văn docs/ARCHITECTURE.md §3 + §4.
// Lưu ý: expectTypeOf là assert compile-time — được tsc kiểm khi `next build`
// (tsconfig include **/*.ts), còn vitest chạy phần assert giá trị.

describe('doc.types — El union 6 loại (docs/ARCHITECTURE.md §3)', () => {
  it('ElType đủ 6 giá trị cố định — không thêm/bớt element type (AGENTS.md nguyên tắc 3)', () => {
    expectTypeOf<ElType>().toEqualTypeOf<'text' | 'rect' | 'line' | 'image' | 'path' | 'repeat'>()
  })

  it('El là union đủ 6 interface element', () => {
    expectTypeOf<El>().toEqualTypeOf<TextEl | RectEl | LineEl | ImageEl | PathEl | RepeatEl>()
  })

  it('phân biệt đủ 6 loại theo field `type`', () => {
    expectTypeOf<Extract<El, { type: 'text' }>>().toEqualTypeOf<TextEl>()
    expectTypeOf<Extract<El, { type: 'rect' }>>().toEqualTypeOf<RectEl>()
    expectTypeOf<Extract<El, { type: 'line' }>>().toEqualTypeOf<LineEl>()
    expectTypeOf<Extract<El, { type: 'image' }>>().toEqualTypeOf<ImageEl>()
    expectTypeOf<Extract<El, { type: 'path' }>>().toEqualTypeOf<PathEl>()
    expectTypeOf<Extract<El, { type: 'repeat' }>>().toEqualTypeOf<RepeatEl>()
  })

  it('BaseEl giữ dataBinding?: null (预留 — giữ null ở MVP)', () => {
    expectTypeOf<BaseEl['dataBinding']>().toEqualTypeOf<null | undefined>()
  })

  it("RepeatEl['dataBinding'] = { source: 'items' } — bắt buộc, không phải null (§3 dòng 101)", () => {
    expectTypeOf<RepeatEl['dataBinding']>().toEqualTypeOf<{ source: 'items' }>()
    expectTypeOf<RepeatEl['overflow']>().toEqualTypeOf<'paginate'>()
    expectTypeOf<RepeatEl['itemTemplate']['elements']>().toEqualTypeOf<El[]>()
  })
})

describe('doc.types — A4Doc (docs/ARCHITECTURE.md §3 dòng 107-111)', () => {
  it('schemaVersion là literal 1', () => {
    expectTypeOf<A4Doc['schemaVersion']>().toEqualTypeOf<1>()
  })

  it("page là literal 210×297 'mm' — không nới thành number/string", () => {
    expectTypeOf<A4Doc['page']['w']>().toEqualTypeOf<210>()
    expectTypeOf<A4Doc['page']['h']>().toEqualTypeOf<297>()
    expectTypeOf<A4Doc['page']['unit']>().toEqualTypeOf<'mm'>()
  })

  it("page khớp GIÁ TRỊ hằng A4 từ ./a4 — một hệ tọa độ mm chung cho preview lẫn PDF", () => {
    const page: A4Doc['page'] = { w: A4.w, h: A4.h, unit: A4.unit }
    expect(page).toEqual({ w: 210, h: 297, unit: 'mm' })
  })
})

describe('doc.types — Patch theo id (docs/ARCHITECTURE.md §4 dòng 124-129)', () => {
  type PatchOp = Patch extends { op: infer O } ? O : never

  it('đủ 4 op: update | add | remove | none', () => {
    expectTypeOf<PatchOp>().toEqualTypeOf<'update' | 'add' | 'remove' | 'none'>()
  })

  it("update: path string + value unknown", () => {
    expectTypeOf<Extract<Patch, { op: 'update' }>['path']>().toEqualTypeOf<string>()
    expectTypeOf<Extract<Patch, { op: 'update' }>['value']>().toEqualTypeOf<unknown>()
  })

  it("add: element là El lồng, after tùy chọn — id CLIENT cấp trước, AI chỉ dùng lại", () => {
    expectTypeOf<Extract<Patch, { op: 'add' }>['element']>().toEqualTypeOf<El>()
    expectTypeOf<Extract<Patch, { op: 'add' }>['after']>().toEqualTypeOf<string | undefined>()
  })

  it("remove: chỉ id", () => {
    expectTypeOf<Extract<Patch, { op: 'remove' }>['id']>().toEqualTypeOf<string>()
  })

  it("none: reason string tiếng Việt", () => {
    expectTypeOf<Extract<Patch, { op: 'none' }>['reason']>().toEqualTypeOf<string>()
  })
})
