/**
 * snap — snap 0.5mm + hình học move/resize (gói M1.5 Quick Tap).
 *
 * Nguồn:
 * - 02-plan 20261102-m15-quick-tap Bước 1: snapMm / applyMove / applyResize / ResizeHandle.
 * - docs/ARCHITECTURE.md §7 (skill signboard-frontend: "Move/resize tự viết bằng pointer
 *   events + snap 0.5mm — không kéo thư viện drag vào") — component chỉ orchestrate,
 *   MỌI phép toán hình học nằm ở file này (thuần deterministic).
 * - Bound clamp theo Zod: InPage [-5, 302] (doc.zod.ts:14), w ≤ 215 / h ≤ 302
 *   (doc.zod.ts:18) — PL-4: chỉ hard-clamp theo bound Zod, margin 8mm KHÔNG chặn ở M1.5.
 *
 * Engine thuần (skill signboard-engine): chỉ import './a4' — không React, không DOM,
 * không network, chạy 100% trong vitest node.
 */
import { A4 } from './a4'

/** M1.5 chỉ 4 handle góc (PL-8 — không handle cạnh n/s/e/w). */
export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw'

/**
 * Kích thước nhỏ nhất sau snap (mm). Snap 0.2 → 0 sẽ ra `w = 0` vi phạm `positive()`
 * của Zod (doc.zod.ts:18) → bắt buộc sàn 0.5 (02-plan Bước 1).
 */
export const MIN_SIZE_MM = 0.5

/** Bound Zod InPage (doc.zod.ts:14): cho phép sai số nhỏ 5mm ngoài mép trang. */
const IN_PAGE_MIN = -5
const IN_PAGE_MAX = A4.h + 5 // = 302 (doc.zod.ts:14)
/** Trần kích thước (doc.zod.ts:18): w ≤ 215 = A4.w + 5, h ≤ 302 = A4.h + 5. */
const MAX_W_MM = A4.w + 5
const MAX_H_MM = A4.h + 5

/** Làm tròn về bội 0.5mm gần nhất. */
export function snapMm(v: number): number {
  return Math.round(v * 2) / 2
}

/** Kẹp tọa độ về khoảng InPage [-5, 302] (doc.zod.ts:14). */
const clampPos = (v: number): number => Math.min(IN_PAGE_MAX, Math.max(IN_PAGE_MIN, v))

/**
 * Dời element theo delta mm (delta hệ PAGE — move không phụ thuộc rotation của element):
 * `x = clampPos(snapMm(x0 + dx))`, giữ nguyên w/h (caller không gửi patch w/h).
 */
export function applyMove(
  start: { x: number; y: number },
  dxMm: number,
  dyMm: number,
): { x: number; y: number } {
  return { x: clampPos(snapMm(start.x + dxMm)), y: clampPos(snapMm(start.y + dyMm)) }
}

/**
 * Resize theo handle góc, `dx/dy` là delta hệ tọa độ LOCAL của element (component
 * inverse-rotate trước khi gọi nếu element xoay — PL-6 xấp xỉ axis-aligned MVP).
 * Thứ tự (02-plan Bước 1):
 * (a) kích thước mới theo handle (se: w+dx/h+dy; nw: w−dx/h−dy; ne: w+dx/h−dy;
 *     sw: w−dx/h+dy) → snap → sàn MIN_SIZE_MM → trần w ≤ 215, h ≤ 302;
 * (b) tọa độ giữ CẠN ĐỐI DIỆN cố định (nw: x' = x0 + (w0 − w')) → snap → clamp [-5,302].
 */
export function applyResize(
  start: { x: number; y: number; w: number; h: number },
  handle: ResizeHandle,
  dxMm: number,
  dyMm: number,
): { x: number; y: number; w: number; h: number } {
  // (a) kích thước: handle đông (ne/se) làm w tăng, handle nam (se/sw) làm h tăng
  const dw = handle === 'se' || handle === 'ne' ? dxMm : -dxMm
  const dh = handle === 'se' || handle === 'sw' ? dyMm : -dyMm
  const w = Math.min(MAX_W_MM, Math.max(MIN_SIZE_MM, snapMm(start.w + dw)))
  const h = Math.min(MAX_H_MM, Math.max(MIN_SIZE_MM, snapMm(start.h + dh)))

  // (b) tọa độ: chỉ handle TÂY (nw/sw) dời x, handle BẮC (nw/ne) dời y — cạnh đối diện đứng yên
  const x = handle === 'nw' || handle === 'sw' ? clampPos(snapMm(start.x + (start.w - w))) : start.x
  const y = handle === 'nw' || handle === 'ne' ? clampPos(snapMm(start.y + (start.h - h))) : start.y
  return { x, y, w, h }
}
