'use client'

/**
 * SelectableA4Preview — A4Preview + hit-testing M1.4 (docs/ARCHITECTURE.md §7 dòng 187).
 *
 * - pointerdown (mouse + touch unified — KHÔNG onClick/onTouchStart riêng, KHÔNG
 *   preventDefault để giữ scroll mobile) → getBoundingClientRect → px→mm
 *   `(clientX - rect.left) / rect.width * 210` (nhân bản cho trục y) → elementAtPoint
 *   (engine thuần) → selection. State là React state CỤC BỘ — editorStore là M1.6
 *   (02-plan Quyết định 5, không tạo store sớm).
 * - Viền chọn = overlay SVG thứ 2 `pointer-events-none` cùng viewBox 0 0 210 297, đè
 *   cùng CSS box với SVG engine (A4Preview div không padding, svg h-auto w-full định
 *   nghĩa kích thước wrapper) → hệ tọa độ mm trùng khớp tuyệt đối; chuỗi render engine
 *   M1.3 + 56 snapshot KHÔNG đổi (02-plan Quyết định 6). Viền theo bbox KHAI BÁO, tâm
 *   quay transform đúng như elTransform engine. Stroke #2563EB là UI chrome ngoài
 *   palette in — không phải element doc, không in ra (tiền lệ placeholder #EEEEEE).
 * - `touchAction: 'manipulation'` chống double-tap zoom delay (DoD M1 "< 3 giây").
 * - Bỏ chọn = bấm NGOÀI tờ A4 (document pointerdown — pattern click-outside): demo-doc
 *   có E1 nền full-page z=1 nên mọi click TRÊN tờ luôn trúng ít nhất E1; vùng "trống"
 *   thực tế là ngoài preview (tiêu đề trang, nền page) — 02-plan Quyết định 12.
 */
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { A4 } from '@/engine/a4'
import { elementAtPoint } from '@/engine/hit-test'
import type { A4Doc } from '@/engine/doc.types'
import A4Preview from '@/components/editor/A4Preview'

export default function SelectableA4Preview({
  doc,
  className,
}: {
  doc: A4Doc
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Click ngoài preview → bỏ chọn; pointerdown trong ref.current giữ nguyên selection
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      setSelectedId(null)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) {
      setSelectedId(null)
      return
    }
    const mmX = ((e.clientX - rect.left) / rect.width) * A4.w
    const mmY = ((e.clientY - rect.top) / rect.height) * A4.h
    setSelectedId(elementAtPoint(doc, { x: mmX, y: mmY }))
  }

  const selected = selectedId === null ? undefined : doc.elements.find((el) => el.id === selectedId)
  const transform =
    selected && selected.rotation !== undefined && selected.rotation !== 0
      ? `rotate(${selected.rotation}, ${selected.x + selected.w / 2}, ${selected.y + selected.h / 2})`
      : undefined

  return (
    <div ref={ref} onPointerDown={onPointerDown} style={{ touchAction: 'manipulation' }}>
      <div className="relative">
        <A4Preview doc={doc} className={className} />
        <svg
          viewBox={`0 0 ${A4.w} ${A4.h}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {selected && (
            <rect
              x={selected.x}
              y={selected.y}
              width={selected.w}
              height={selected.h}
              fill="none"
              stroke="#2563EB"
              strokeWidth={0.8}
              transform={transform}
            />
          )}
        </svg>
      </div>
    </div>
  )
}
