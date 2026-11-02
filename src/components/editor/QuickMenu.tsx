'use client'

/**
 * QuickMenu + InlineTextInput — menu thao tác nhanh khi chọn element (gói M1.5,
 * docs/ARCHITECTURE.md §1 liệt kê `QuickMenu.tsx`).
 *
 * - 100% LOCAL, 0 lượt AI (PRD §4.2, skill signboard-frontend:58): Sửa chữ / Đổi màu /
 *   Tầng lên xuống / Xóa đều phát `Patch[]` qua `onApplyPatches` → engine patch-apply.
 *   KHÔNG có nút "AI sửa mục này" (Quyết định 2A); sửa chữ qua menu mở InlineTextInput
 *   đè lên element (Quyết định 3A — không double-tap).
 * - 1 component CSS responsive (skill signboard-frontend): mobile bottom-sheet
 *   `fixed inset-x-0 bottom-0`, desktop card `md:static` cạnh preview — chưa có
 *   sidebar (M1.7). Root mang `data-quick-tap-ui` để SelectableA4Preview loại trừ
 *   khỏi click-outside deselect (PL-7).
 * - Đổi màu: palette in an toàn 8 màu + ô hex; field đích theo loại element
 *   (text/rect → fill; line → stroke; path → fill ?? stroke; image/repeat → ẩn mục).
 * - Component chỉ orchestrate — tính tầng bởi engine zShiftPatches, áp patch bởi page.
 */
import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { A4 } from '@/engine/a4'
import { zShiftPatches } from '@/engine/patch-apply'
import type { A4Doc, El, Patch, TextEl } from '@/engine/doc.types'

/**
 * Palette in an toàn 8 màu — NGUỒN: docs/SYSTEM_PROMPTS.md dòng 25 (STATIC_PREFIX).
 * KHÔNG tự thêm/bớt màu: muốn đổi → chỉnh SYSTEM_PROMPTS.md trước rồi mirror lại
 * (AGENTS.md nguyên tắc 4).
 */
const SAFE_PALETTE = [
  '#FFFFFF', // trắng (nền)
  '#D32F2F', // đỏ
  '#FBC02D', // vàng
  '#2E7D32', // xanh lá
  '#1565C0', // xanh dương
  '#212121', // đen mực
  '#FFF3CD', // vàng nhạt (băng)
  '#FFF8F0', // kem (nền)
] as const

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

const TYPE_LABEL: Record<El['type'], string> = {
  text: 'Chữ',
  rect: 'Khung nền',
  line: 'Đường kẻ',
  image: 'Ảnh',
  path: 'Họa tiết',
  repeat: 'Lưới lặp',
}

/** Field màu đích theo loại element — image/repeat không có field màu (Khuyến nghị 4 scout). */
function colorTargetPath(el: El): 'props.fill' | 'props.stroke' | null {
  switch (el.type) {
    case 'text':
    case 'rect':
      return 'props.fill'
    case 'line':
      return 'props.stroke'
    case 'path':
      // E7 stroke-only → đổi stroke; có đủ fill → đổi fill
      return el.props.fill !== undefined ? 'props.fill' : 'props.stroke'
    default:
      return null
  }
}

const BTN =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 ' +
  'hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'

export default function QuickMenu({
  doc,
  selected,
  applyError,
  onApplyPatches,
  onDeselect,
  onStartEditText,
}: {
  doc: A4Doc
  selected: El | null
  /** reason cuối từ skipped của applyPatches (page giữ state) — footer hiển thị, không dựng toast (M4). */
  applyError: string | null
  onApplyPatches: (patches: Patch[]) => void
  onDeselect: () => void
  onStartEditText: () => void
}) {
  const [hex, setHex] = useState('')
  const [hexError, setHexError] = useState<string | null>(null)

  if (selected === null) return null

  const colorPath = colorTargetPath(selected)
  const upPatches = zShiftPatches(doc, selected.id, 'up')
  const downPatches = zShiftPatches(doc, selected.id, 'down')
  const isText = selected.type === 'text'

  const applyColor = (value: string): void => {
    if (colorPath === null) return
    if (!HEX_RE.test(value)) {
      setHexError('Mã màu phải dạng #RRGGBB')
      return
    }
    setHexError(null)
    setHex('')
    onApplyPatches([{ op: 'update', id: selected.id, path: colorPath, value }])
  }

  return (
    <div
      data-quick-tap-ui="true"
      role="toolbar"
      aria-label="Thanh thao tác nhanh"
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-white p-3 shadow-lg pb-[env(safe-area-inset-bottom)] md:static md:w-full md:max-w-[420px] md:rounded-2xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {TYPE_LABEL[selected.type]} · {selected.id}
        </p>
        <button
          type="button"
          onClick={onDeselect}
          aria-label="Đóng menu"
          title="Đóng menu"
          className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onStartEditText}
          disabled={!isText}
          aria-label="Sửa chữ"
          title={isText ? 'Sửa chữ' : 'Chỉ áp dụng cho phần tử chữ'}
          className={BTN}
        >
          Sửa chữ
        </button>
        <button
          type="button"
          onClick={() => onApplyPatches(upPatches)}
          disabled={upPatches.length === 0}
          aria-label="Đưa phần tử lên tầng trên"
          title="Đưa phần tử lên tầng trên"
          className={BTN}
        >
          Tầng lên
        </button>
        <button
          type="button"
          onClick={() => onApplyPatches(downPatches)}
          disabled={downPatches.length === 0}
          aria-label="Đưa phần tử xuống tầng dưới"
          title="Đưa phần tử xuống tầng dưới"
          className={BTN}
        >
          Tầng xuống
        </button>
        <button
          type="button"
          onClick={() => onApplyPatches([{ op: 'remove', id: selected.id }])}
          aria-label="Xóa phần tử"
          title="Xóa phần tử"
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Xóa
        </button>
      </div>

      {colorPath !== null && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-gray-600">Đổi màu</p>
          <div className="flex flex-wrap items-center gap-2">
            {SAFE_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => applyColor(c)}
                aria-label={`Đổi màu ${c}`}
                title={c}
                className={`h-7 w-7 rounded-full border-2 ${
                  c === '#FFFFFF' ? 'border-gray-300' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              applyColor(hex.trim())
            }}
          >
            <input
              value={hex}
              onChange={(e) => {
                setHex(e.target.value)
                setHexError(null)
              }}
              placeholder="#RRGGBB"
              aria-label="Mã màu hex"
              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-600"
              style={{ touchAction: 'manipulation' }}
            />
            <button type="submit" aria-label="Áp dụng mã màu" title="Áp dụng mã màu" className={BTN}>
              Áp dụng
            </button>
          </form>
          {hexError !== null && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {hexError}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500">
        Kéo phần tử để di chuyển, kéo góc để đổi kích thước (bước 0,5mm)
      </p>
      {applyError !== null && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {applyError}
        </p>
      )}
    </div>
  )
}

/**
 * InlineTextInput — ô nhập đè lên element chữ đang chọn (Quyết định 3A).
 * Tọa độ % thuần theo mm (không đo px): left = x/210, top = y/297... — đặt trong
 * wrapper absolute của SelectableA4Preview nên tự khớp mọi viewport. KHÔNG mô phỏng
 * WYSIWYG: font-size cố định khả dụng (16px — chống iOS zoom khi focus), kết quả hiện
 * sau commit; font thật theo metric là placeholder M2.4.
 */
export function InlineTextInput({
  el,
  onCommit,
  onCancel,
}: {
  el: TextEl
  onCommit: (text: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(el.props.text)
  const [error, setError] = useState<string | null>(null)
  // Chặn commit 2 lần (Enter → page đóng input → blur bắn tiếp trên element đã unmount)
  const doneRef = useRef(false)

  const commit = (): void => {
    if (doneRef.current) return
    const text = value.trim()
    if (text === '') {
      setError('Chữ không được để trống')
      return
    }
    doneRef.current = true
    onCommit(text)
  }

  const cancel = (): void => {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') cancel()
  }

  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: `${(el.x / A4.w) * 100}%`,
        top: `${(el.y / A4.h) * 100}%`,
        width: `${(el.w / A4.w) * 100}%`,
        height: `${(el.h / A4.h) * 100}%`,
      }}
    >
      <input
        autoFocus
        defaultValue={el.props.text}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={onKeyDown}
        onBlur={commit}
        enterKeyHint="done"
        aria-label="Nội dung chữ"
        className="h-full w-full rounded border-2 border-blue-600 bg-white/90 px-1 text-gray-900 outline-none"
        style={{ fontSize: '16px', touchAction: 'manipulation' }}
      />
      {error !== null && (
        <p role="alert" className="absolute -bottom-6 left-0 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-xs text-red-600 shadow">
          {error}
        </p>
      )}
    </div>
  )
}
