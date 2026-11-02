import { describe, expect, expectTypeOf, it } from 'vitest'
import { A4 } from './a4'

// Unit test thuần cho engine (ngoại lệ no-mock theo AGENTS.md) — không network,
// không dữ liệu: chỉ assert hằng số khổ A4 trích từ docs/ARCHITECTURE.md §3.
describe('Hằng số A4 (docs/ARCHITECTURE.md §3)', () => {
  it('bề ngang 210mm', () => {
    expect(A4.w).toBe(210)
  })

  it('chiều cao 297mm', () => {
    expect(A4.h).toBe(297)
  })

  it('đơn vị là mm — giữ kiểu literal "mm" (không nới thành string)', () => {
    expect(A4.unit).toBe('mm')
    expectTypeOf(A4.unit).toEqualTypeOf<'mm'>()
  })
})
