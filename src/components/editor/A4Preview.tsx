/**
 * A4Preview — component mỏng bọc chuỗi SVG do engine sinh (src/engine/svg-render.tsx).
 *
 * docs/ARCHITECTURE.md §7 dòng 186: "`<svg viewBox="0 0 210 297">` — tọa độ mm dùng thẳng
 * làm đơn vị user, scale tự nhiên bằng CSS" → SVG không set width/height, scale bằng
 * Tailwind child selector [&>svg]:w-full/h-auto — giữ đúng tỉ lệ 210:297 ở mọi viewport,
 * thuần CSS không JS (PC lẫn Mobile Web).
 *
 * Tính an toàn của dangerouslySetInnerHTML: chuỗi SVG do engine deterministic sinh bằng
 * template literal; mọi nội dung text của doc đã escape XML (esc() trong svg-render) và
 * doc đã qua A4DocSchema.parse trước khi vẽ — không nhận HTML tùy ý từ ngoài.
 *
 * M1.3 thuần hiển thị — KHÔNG 'use client' (không pointer events); hit-testing là M1.4.
 */
import type { A4Doc } from '@/engine/doc.types'
import { renderA4DocSvg } from '@/engine/svg-render'

export default function A4Preview({ doc, className }: { doc: A4Doc; className?: string }) {
  return (
    <div
      className={className ?? 'w-full max-w-[420px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full'}
      dangerouslySetInnerHTML={{ __html: renderA4DocSvg(doc) }}
    />
  )
}
