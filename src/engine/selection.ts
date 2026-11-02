/**
 * selection — heuristic bỏ qua element nền + chọn (gói M1.5 Quick Tap).
 *
 * Nguồn:
 * - 02-plan 20261102-m15-quick-tap Bước 2 + Quyết định 1B: click element nền
 *   (rect full-page đúng định nghĩa STATIC_PREFIX) = DESELECT.
 * - docs/SYSTEM_PROMPTS.md dòng 20: định nghĩa element nền full-page.
 *
 * Điểm triển khai DUY NHẤT của quyết định 1B — sau này đổi sang 1A (chọn được nền)
 * hay 1C (schema flag) chỉ sửa file này, 0 đụng schema/renderer (02-plan Quyết định 1).
 *
 * Engine thuần (skill signboard-engine): chỉ import './doc.types' + './hit-test'
 * (import CHỈ ĐỌC, không sửa hit-test.ts) — không React, không DOM, không network.
 */
import type { A4Doc, El } from './doc.types'
import { elementAtPoint } from './hit-test'
import type { Pt } from './hit-test'

/**
 * Element nền = rect PHỦ KÍN cả trang, không xoay — đúng định nghĩa STATIC_PREFIX
 * (docs/SYSTEM_PROMPTS.md dòng 20). Cho phép tràn mép (x ≤ 0, w ≥ page.w) vì nền
 * thường được chạm mép hoặc tràn sát khổ giấy (demo-doc E1: x=0, y=0, 210×297).
 */
export function isBackgroundElement(el: El, page: { w: number; h: number }): boolean {
  return (
    el.type === 'rect' &&
    (el.rotation === undefined || el.rotation === 0) &&
    el.x <= 0 &&
    el.y <= 0 &&
    el.w >= page.w &&
    el.h >= page.h
  )
}

/**
 * Tìm id element chọn được tại điểm mm trên trang; không trúng HOẶC trúng element
 * nền → null (click nền = deselect — Quyết định 1B). Hit-test gốc (z giảm dần,
 * tie-break index mảng) delegate nguyên vẹn cho elementAtPoint của './hit-test'.
 */
export function selectableElementAtPoint(doc: A4Doc, point: Pt): string | null {
  const id = elementAtPoint(doc, point)
  if (id === null) return null
  const el = doc.elements.find((e) => e.id === id)
  if (el !== undefined && isBackgroundElement(el, doc.page)) return null
  return id
}
