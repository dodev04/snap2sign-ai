'use client'

/**
 * SelectableA4Preview — A4Preview + hit-testing M1.4 + gesture move/resize M1.5
 * (docs/ARCHITECTURE.md §7).
 *
 * - CONTROLLED (02-plan Bước 5): state `doc` + `selectedId` lift lên EditorPage —
 *   component nhận `doc / selectedId / onSelect / onApplyPatches`. Mọi biến đổi doc
 *   đi qua patch (engine patch-apply) — component KHÔNG tự setDoc. editorStore là M1.6.
 * - pointerdown (mouse + touch unified) → getBoundingClientRect → px→mm →
 *   `selectableElementAtPoint` (engine selection — click nền E1 = deselect, Quyết định 1B).
 * - Move/resize TỰ VIẾT bằng pointer events + snap 0.5mm (skill signboard-frontend —
 *   không thư viện drag): drag-surface phủ bbox + 4 handle góc (PL-8), pointer capture
 *   trên chính rect đó, mm TUYỆT ĐỐI tính lại từ getBoundingClientRect() mỗi move
 *   (chống drift khi scroll — PL-5). Hit-test CHỈ chạy lúc pointerdown — TUYỆT ĐỐI
 *   không gọi trong pointermove (parse Zod mỗi frame — Rủi ro 4 scout). Hình học
 *   (snap/clamp/resize) toàn bộ trong engine `snap.ts` — component chỉ orchestrate.
 * - Resize element xoay: delta PAGE đổi sang LOCAL qua `inverseRotate` quanh tâm bbox
 *   lúc BẮT ĐẦU kéo, handle axis-aligned — xấp xỉ MVP (PL-6, spec chưa định nghĩa).
 * - Viền/handle #2563EB là UI chrome ngoài palette in — không phải element doc,
 *   không in ra (tiền lệ placeholder #EEEEEE M1.3).
 * - `touchAction: 'manipulation'` ở wrapper giữ scroll trang (PL-10); chỉ drag-surface
 *   + handle là `'none'`. Slot `children` (InlineTextInput) đặt sau overlay svg,
 *   wrapper slot `pointer-events-none` — children tự bật `pointer-events-auto`.
 * - Bỏ chọn = bấm ngoài tờ A4 (pattern click-outside), LOẠI TRỪ vùng `[data-quick-tap-ui]`
 *   của QuickMenu (PL-7 — pointerdown trên menu sẽ deselect trước khi click chạy).
 */
import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { A4 } from '@/engine/a4'
import { inverseRotate } from '@/engine/hit-test'
import type { Pt } from '@/engine/hit-test'
import { selectableElementAtPoint } from '@/engine/selection'
import { applyMove, applyResize } from '@/engine/snap'
import type { ResizeHandle } from '@/engine/snap'
import type { A4Doc, Patch } from '@/engine/doc.types'
import A4Preview from '@/components/editor/A4Preview'

/** Ngưỡng bắt đầu kéo (mm) — phân biệt tap giữ chọn vs drag (02-plan Bước 5). */
const DRAG_THRESHOLD_MM = 1.5
/** Handle góc: vùng chạm (mm, cỡ ngón tay mobile) + chấm hiển thị (mm). */
const HANDLE_HIT_MM = 8
const HANDLE_VISUAL_MM = 2.5
const HANDLE_STROKE_MM = 0.4

/** Trạng thái một cử chỉ kéo đang chạy — sống trong ref, sống sót qua các lần re-render. */
interface DragState {
  mode: 'move' | 'resize'
  handle: ResizeHandle | null
  startMm: Pt
  geom: { x: number; y: number; w: number; h: number }
  center: Pt
  rotation: number
  moved: boolean
}

export default function SelectableA4Preview({
  doc,
  selectedId,
  onSelect,
  onApplyPatches,
  className,
  children,
}: {
  doc: A4Doc
  selectedId: string | null
  onSelect: (id: string | null) => void
  onApplyPatches: (patches: Patch[]) => void
  className?: string
  children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)

  // Click ngoài preview → bỏ chọn; pointerdown trong ref.current giữ nguyên selection.
  // PL-7: pointerdown trong QuickMenu ([data-quick-tap-ui]) KHÔNG deselect.
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      if (e.target instanceof Element && e.target.closest('[data-quick-tap-ui]')) return
      onSelect(null)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [onSelect])

  /** px → mm tuyệt đối — ĐO LẠI getBoundingClientRect() mỗi lần gọi (chống drift khi scroll). */
  const clientToMm = (clientX: number, clientY: number): Pt | null => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    return {
      x: ((clientX - rect.left) / rect.width) * A4.w,
      y: ((clientY - rect.top) / rect.height) * A4.h,
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const mm = clientToMm(e.clientX, e.clientY)
    onSelect(mm === null ? null : selectableElementAtPoint(doc, mm))
  }

  // ─── Gesture move/resize (pointer capture; hit-test KHÔNG chạy trong move) ───

  const beginDrag = (
    e: ReactPointerEvent<SVGRectElement>,
    mode: 'move' | 'resize',
    handle: ResizeHandle | null,
  ) => {
    const selected = selectedId === null ? undefined : doc.elements.find((el) => el.id === selectedId)
    const mm = clientToMm(e.clientX, e.clientY)
    if (!selected || mm === null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode,
      handle,
      startMm: mm,
      geom: { x: selected.x, y: selected.y, w: selected.w, h: selected.h },
      center: { x: selected.x + selected.w / 2, y: selected.y + selected.h / 2 },
      rotation: selected.rotation ?? 0,
      moved: false,
    }
  }

  /** Chỉ phát patch cho field thực đổi so với hình lúc bắt đầu kéo (tránh op 0-đổi). */
  const geomPatches = (id: string, geom: DragState['geom'], next: DragState['geom']): Patch[] => {
    const entries: Array<['x' | 'y' | 'w' | 'h', number]> = [
      ['x', next.x],
      ['y', next.y],
      ['w', next.w],
      ['h', next.h],
    ]
    return entries
      .filter(([field, value]) => value !== geom[field])
      .map(([field, value]) => ({ op: 'update' as const, id, path: field, value }))
  }

  const onDragMove = (e: ReactPointerEvent<SVGRectElement>) => {
    const drag = dragRef.current
    const selected = selectedId === null ? undefined : doc.elements.find((el) => el.id === selectedId)
    const now = clientToMm(e.clientX, e.clientY)
    if (!drag || !selected || now === null) return

    if (drag.mode === 'move') {
      const dx = now.x - drag.startMm.x
      const dy = now.y - drag.startMm.y
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_MM) return
      drag.moved = true
      onApplyPatches(geomPatches(selected.id, drag.geom, { ...drag.geom, ...applyMove(drag.geom, dx, dy) }))
      return
    }

    if (drag.handle === null) return
    // Resize: delta PAGE-frame → LOCAL-frame nếu element xoay (PL-6 — tâm quay cố định
    // theo bbox lúc BẮT ĐẦU kéo, không theo bbox đang thay đổi)
    let dx = now.x - drag.startMm.x
    let dy = now.y - drag.startMm.y
    if (drag.rotation !== 0) {
      const startLocal = inverseRotate(drag.startMm, drag.center, drag.rotation)
      const nowLocal = inverseRotate(now, drag.center, drag.rotation)
      dx = nowLocal.x - startLocal.x
      dy = nowLocal.y - startLocal.y
    }
    drag.moved = true
    onApplyPatches(geomPatches(selected.id, drag.geom, applyResize(drag.geom, drag.handle, dx, dy)))
  }

  const endDrag = (e: ReactPointerEvent<SVGRectElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag !== null && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  // ─── Overlay ───

  const selected = selectedId === null ? undefined : doc.elements.find((el) => el.id === selectedId)
  const transform =
    selected && selected.rotation !== undefined && selected.rotation !== 0
      ? `rotate(${selected.rotation}, ${selected.x + selected.w / 2}, ${selected.y + selected.h / 2})`
      : undefined

  /** Tâm 4 handle = 4 góc bbox khai báo — nằm trong <g> cùng transform xoay như viền. */
  const HANDLE_CORNERS: Array<{ handle: ResizeHandle; cx: number; cy: number; cursor: string }> = selected
    ? [
        { handle: 'nw', cx: selected.x, cy: selected.y, cursor: 'nwse-resize' },
        { handle: 'ne', cx: selected.x + selected.w, cy: selected.y, cursor: 'nesw-resize' },
        { handle: 'se', cx: selected.x + selected.w, cy: selected.y + selected.h, cursor: 'nwse-resize' },
        { handle: 'sw', cx: selected.x, cy: selected.y + selected.h, cursor: 'nesw-resize' },
      ]
    : []

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
            <g transform={transform}>
              {/* Viền chọn theo bbox khai báo (M1.4) */}
              <rect
                x={selected.x}
                y={selected.y}
                width={selected.w}
                height={selected.h}
                fill="none"
                stroke="#2563EB"
                strokeWidth={0.8}
              />
              {/* Drag-surface: phủ đúng bbox, nhận pointer (inline style đè class
                  pointer-events-none của svg cha), capture + move qua engine snap */}
              <rect
                x={selected.x}
                y={selected.y}
                width={selected.w}
                height={selected.h}
                fill="transparent"
                style={{ pointerEvents: 'fill', touchAction: 'none', cursor: 'move' }}
                onPointerDown={(e) => beginDrag(e, 'move', null)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              {/* 4 handle góc: mỗi handle 2 rect (hit lớn + visual nhỏ) — visual
                  pointerEvents none để event rơi xuống hit rect bên dưới */}
              {HANDLE_CORNERS.map(({ handle, cx, cy, cursor }) => (
                <g key={handle}>
                  <rect
                    x={cx - HANDLE_HIT_MM / 2}
                    y={cy - HANDLE_HIT_MM / 2}
                    width={HANDLE_HIT_MM}
                    height={HANDLE_HIT_MM}
                    fill="transparent"
                    style={{ pointerEvents: 'fill', touchAction: 'none', cursor }}
                    onPointerDown={(e) => beginDrag(e, 'resize', handle)}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  />
                  <rect
                    x={cx - HANDLE_VISUAL_MM / 2}
                    y={cy - HANDLE_VISUAL_MM / 2}
                    width={HANDLE_VISUAL_MM}
                    height={HANDLE_VISUAL_MM}
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth={HANDLE_STROKE_MM}
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              ))}
            </g>
          )}
        </svg>
        {/* Slot cho InlineTextInput — đặt SAU overlay svg; wrapper pointer-events-none,
            children tự bật pointer-events-auto (02-plan Bước 5) */}
        {children !== undefined && <div className="pointer-events-none absolute inset-0">{children}</div>}
      </div>
    </div>
  )
}
