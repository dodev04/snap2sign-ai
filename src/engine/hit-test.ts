/**
 * hit-test — chọn element bằng điểm mm trên trang A4 (gói M1.4).
 *
 * Nguồn:
 * - docs/ARCHITECTURE.md §7 dòng 187: hit-testing pointer → mm, duyệt elements theo
 *   z GIẢM dần (ngược thứ tự vẽ của renderer), bbox chứa điểm, có rotation thì transform
 *   ngược điểm trước khi test.
 * - docs/ROADMAP.md dòng 16: việc M1.4 "hit-testing + viền chọn".
 *
 * Engine thuần deterministic (skill signboard-engine): chỉ import './doc.types' |
 * './doc.zod' — không React, không DOM, không network, chạy 100% trong vitest node.
 * Đối xứng ngược renderA4DocSvg (svg-render.tsx): renderer sort z tăng dần stable rồi vẽ
 * xuôi (sau = vẽ sau = nằm trên) → hit-test duyệt z giảm dần để gặp element trên cùng trước.
 */
import type { A4Doc, El } from './doc.types'
import { A4DocSchema } from './doc.zod'

/** Điểm mm trong hệ tọa độ trang (gốc (0,0) góc trên-trái, x → phải, y → xuống). */
export interface Pt {
  x: number
  y: number
}

/**
 * Tolerance nở bbox riêng cho `line` (mm) — quyết định plan-level 02-plan Quyết định 2
 * (spec chưa định nghĩa): theo cỡ ngón tay mobile, preview ~350px/210mm ≈ 1.67px/mm →
 * dải chạm ~10.5mm ≈ 17px. Nở trong hệ tọa độ LOCAL của element (sau inverse-rotate)
 * nên line xoay vẫn được nở đúng theo trục line.
 */
export const HIT_TOLERANCE_MM = 5

/** Chống bụi số thực sau phép quay (biên bbox INCLUSIVE). */
const EPS = 1e-6

/**
 * Nghịch đảo phép `rotate(deg, cx, cy)` của SVG — cùng cách elTransform (svg-render.tsx)
 * sinh transform cho element, nhưng góc ĐẢO DẤU: quay điểm trên trang ĐI ngược về hệ
 * tọa độ LOCAL của element, để kiểm contains trên bbox khai báo x/y/w/h nguyên trạng.
 */
export function inverseRotate(point: Pt, center: Pt, rotationDeg: number): Pt {
  const rad = (-rotationDeg * Math.PI) / 180
  const dx = point.x - center.x
  const dy = point.y - center.y
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

/**
 * Kiểm điểm mm có trúng element không.
 * - `rotation` xác định ≠ 0 → inverse-rotate điểm quanh TÂM bbox khai báo
 *   (x + w/2, y + h/2) TRƯỚC — đúng cùng tâm quay như elTransform.
 * - Contains trên bbox KHAI BÁO, biên inclusive ±EPS: `text` không đo glyph,
 *   `path` không parse `d`, `repeat` không descend vào itemTemplate (02-plan Q3/Q4).
 * - Chỉ `line` được nở pad = HIT_TOLERANCE_MM; 5 type còn lại pad = 0.
 */
export function hitTestElement(el: El, point: Pt): boolean {
  let p = point
  if (el.rotation !== undefined && el.rotation !== 0) {
    p = inverseRotate(point, { x: el.x + el.w / 2, y: el.y + el.h / 2 }, el.rotation)
  }
  const pad = el.type === 'line' ? HIT_TOLERANCE_MM : 0
  return (
    p.x >= el.x - pad - EPS &&
    p.x <= el.x + el.w + pad + EPS &&
    p.y >= el.y - pad - EPS &&
    p.y <= el.y + el.h + pad + EPS
  )
}

/**
 * Tìm id element TRÊN CÙNG tại điểm mm; không trúng → null.
 * (a) `A4DocSchema.parse` đầu vào — đối xứng renderA4DocSvg (02-plan M1.3 Quyết định 8):
 *     doc sai schema throw ZodError sớm, deterministic.
 * (b) Duyệt theo thứ tự NGƯỢC thứ tự vẽ của renderer: sort (z giảm dần, index mảng gốc
 *     giảm dần) rồi duyệt xuôi, phần tử đầu tiên thoả hitTestElement → trả id.
 *     Tie-break `b.i - a.i` là BẮT BUỘC (02-plan Q7): renderer sort z tăng dần STABLE nên
 *     cùng z thì phần tử SAU trong mảng gốc được vẽ sau = nằm trên — chỉ sort z giảm
 *     stable rồi duyệt xuôi sẽ trúng phần tử DƯỚI (bug đã chặn bằng unit test riêng).
 */
export function elementAtPoint(doc: A4Doc, point: Pt): string | null {
  const parsed = A4DocSchema.parse(doc)
  const ordered = parsed.elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => b.el.z - a.el.z || b.i - a.i)
  for (const { el } of ordered) {
    if (hitTestElement(el, point)) return el.id
  }
  return null
}
