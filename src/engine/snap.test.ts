import { describe, expect, it } from 'vitest'
import { MIN_SIZE_MM, applyMove, applyResize, snapMm } from './snap'

// Unit test thuần node cho engine snap (ngoại lệ no-mock duy nhất theo AGENTS.md —
// engine không chứa dữ liệu, không network; không vi.mock bất kỳ thứ gì).
// Fixture là số thuần — không cần fixture doc. So sánh bằng epsilon chống bụi
// floating-point (0.5 không biểu diễn chính xác trong binary — 02-plan Bước 1).

const EPS = 1e-9
const closeTo = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThan(EPS)
/** Kiểm v là bội 0.5 (sau snap mọi output phải thoả). */
const isHalfMultiple = (v: number) => Math.abs(v * 2 - Math.round(v * 2)) < EPS

// ─── snapMm ───

describe('snapMm', () => {
  it('snapMm(10.1) = 10 (làm tròn xuống bội 0.5 gần nhất)', () => closeTo(snapMm(10.1), 10))
  it('snapMm(10.26) = 10.5 (làm tròn lên)', () => closeTo(snapMm(10.26), 10.5))
  it('snapMm(-0.24) = 0 (số âm làm tròn về 0)', () => closeTo(snapMm(-0.24), 0))
  it('snapMm(15.5) = 15.5 (số đã bội 0.5 giữ nguyên)', () => closeTo(snapMm(15.5), 15.5))
})

// ─── applyMove ───

describe('applyMove', () => {
  it('dời thường: (10,20) + (3.3, 4.7) → (13.5, 24.5) — bội 0.5 sau snap', () => {
    const r = applyMove({ x: 10, y: 20 }, 3.3, 4.7)
    closeTo(r.x, 13.5)
    closeTo(r.y, 24.5)
  })

  it('clamp khi vượt bound InPage [-5, 302] (doc.zod.ts:14): (295,300) + (20,20) → (302,302)', () => {
    const r = applyMove({ x: 295, y: 300 }, 20, 20)
    closeTo(r.x, 302)
    closeTo(r.y, 302)
  })

  it('clamp dưới -5: (0,0) + (-10,-10) → (-5,-5)', () => {
    const r = applyMove({ x: 0, y: 0 }, -10, -10)
    closeTo(r.x, -5)
    closeTo(r.y, -5)
  })

  it('mọi output nguyên bội 0.5 (kể cả sau snap + clamp) với delta lẻ', () => {
    const deltas: Array<[number, number]> = [
      [1.11, 2.22],
      [-3.33, 4.44],
      [300, -300],
      [0.04, -0.04],
    ]
    for (const [dx, dy] of deltas) {
      const r = applyMove({ x: 10.5, y: 20 }, dx, dy)
      expect(isHalfMultiple(r.x)).toBe(true)
      expect(isHalfMultiple(r.y)).toBe(true)
    }
  })
})

// ─── applyResize ───

describe('applyResize', () => {
  const g = { x: 40, y: 50, w: 20, h: 10 }

  it('se +(10,5): w=30 h=15, x/y GIỮ NGUYÊN (cạnh tây-bắc đứng yên)', () => {
    const r = applyResize(g, 'se', 10, 5)
    closeTo(r.w, 30)
    closeTo(r.h, 15)
    closeTo(r.x, 40)
    closeTo(r.y, 50)
  })

  it('nw +(-8,-3): vừa sinh w=28 h=13 vừa dời x=32 y=47 (cạnh đông-nam (60,60) cố định)', () => {
    const r = applyResize(g, 'nw', -8, -3)
    closeTo(r.w, 28) // w − dx = 20 − (−8)
    closeTo(r.h, 13) // h − dy = 10 − (−3)
    closeTo(r.x, 32) // x + (w0 − w') = 40 + (20 − 28)
    closeTo(r.y, 47) // y + (h0 − h') = 50 + (10 − 13)
    closeTo(r.x + r.w, 60) // cạnh đông cố định
    closeTo(r.y + r.h, 60) // cạnh nam cố định
  })

  it('ne +(6,-2): w=26 h=12, x giữ 40, y = 48 (cạnh nam cố định)', () => {
    const r = applyResize(g, 'ne', 6, -2)
    closeTo(r.w, 26)
    closeTo(r.h, 12)
    closeTo(r.x, 40)
    closeTo(r.y, 48)
  })

  it('sw +(-4,2): kéo sang TÂY làm rộng — w=24 h=12, y giữ 50, x = 36 (cạnh đông cố định)', () => {
    const r = applyResize(g, 'sw', -4, 2)
    closeTo(r.w, 24) // w − dx = 20 − (−4)
    closeTo(r.h, 12)
    closeTo(r.x, 36) // x + (w0 − w') = 40 + (20 − 24)
    closeTo(r.y, 50)
    closeTo(r.x + r.w, 60) // cạnh đông cố định
  })

  it('kéo nw qua mép đông (dx=100): w sàn MIN_SIZE_MM=0.5, x = x0 + w0 − 0.5 = 59.5', () => {
    const r = applyResize(g, 'nw', 100, 0)
    closeTo(r.w, MIN_SIZE_MM)
    closeTo(r.x, 40 + 20 - 0.5)
  })

  it('kéo se qua mép tây/nam (dx lớn âm): w/h sàn 0.5, x/y giữ nguyên', () => {
    const r = applyResize(g, 'se', -100, -100)
    closeTo(r.w, MIN_SIZE_MM)
    closeTo(r.h, MIN_SIZE_MM)
    closeTo(r.x, 40)
    closeTo(r.y, 50)
  })

  it('resize vượt trần Zod: w ≤ 215, h ≤ 302 (doc.zod.ts:18)', () => {
    const r = applyResize({ x: 0, y: 0, w: 200, h: 290 }, 'se', 100, 100)
    closeTo(r.w, 215)
    closeTo(r.h, 302)
    closeTo(r.x, 0)
    closeTo(r.y, 0)
  })

  it('nw kéo dày đến trần w=215: x bị clamp về -5 (InPage)', () => {
    const r = applyResize({ x: 0, y: 0, w: 200, h: 100 }, 'nw', -50, 0)
    closeTo(r.w, 215)
    closeTo(r.x, -5) // 0 + 200 − 215 = −15 → clamp −5
  })

  it('delta lẻ được snap: se +(3.14, 2.26) → w=23 (23.14→23), h=12.5 (12.26→12.5)', () => {
    const r = applyResize(g, 'se', 3.14, 2.26)
    closeTo(r.w, 23)
    closeTo(r.h, 12.5)
  })

  it('mọi output bội 0.5 cho cả 4 handle với delta lẻ', () => {
    for (const handle of ['nw', 'ne', 'se', 'sw'] as const) {
      const r = applyResize(g, handle, 3.14, -2.26)
      expect(isHalfMultiple(r.w)).toBe(true)
      expect(isHalfMultiple(r.h)).toBe(true)
      expect(isHalfMultiple(r.x)).toBe(true)
      expect(isHalfMultiple(r.y)).toBe(true)
    }
  })
})
