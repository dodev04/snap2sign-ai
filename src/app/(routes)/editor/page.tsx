'use client'

// Trang editor — M1.5 Quick Tap + M1.6 Undo/Snapshot (editorStore Zustand).
// M1.7: mount CommandBar (pill mobile ↔ sidebar PC — 1 component responsive) xếp
// dưới QuickMenu trong cột phải (02-plan 5A) + nhận thêm metaKey macOS cho
// undo/redo (carry-over review M1.6:76).
//
// - State `doc` + `selectedId` nâng từ useState lên editorStore (M1.6 — 02-plan Bước 4):
//   store là nguồn DUY NHẤT của doc/selectedId; subscribe qua selector từng field
//   (Zustand v5 — re-render tối thiểu). `editingText`/`applyError` giữ useState UI-local.
// - `handleApplyPatches`: gọi action applyPatches của store (bọc engine patch-apply —
//   đẩy past cap 20 + deselect-on-remove); skipped cuối → footer menu (flow lỗi M1.5
//   giữ nguyên, không dựng toast system — M4).
// - Hàng nút "Hoàn tác" / "Làm lại" / "Lưu phiên bản" phía trên preview + label phiên
//   vừa lưu. Snapshots in-memory trong phiên (mất khi refresh là hành vi ĐÚNG theo
//   ARCHITECTURE §5 — DB `snapshots` là M4). Undo/redo khóa khi đang kéo (gesture).
// - Kéo move/resize wrap transaction 1C: onDragBegin/onDragEnd → beginGesture/
//   endGesture — 1 cử chỉ kéo (dù nhiều pointermove) = đúng 1 mục undo.
// - Desktop (02-plan Bước 5): Ctrl/Cmd + Z / Shift+Z / Y (M1.7 thêm metaKey —
//   Cmd+Z/Cmd+Shift+Z/Cmd+Y macOS) — đang gõ trong input/textarea/contentEditable
//   thì trả lại undo ô nhập của trình duyệt, KHÔNG undo doc.
// - Layout responsive giữ M1.5: mobile cột dọc + QuickMenu bottom-sheet fixed (pb-64
//   đệm khi đang chọn); desktop hàng ngang preview + cột menu.
// - Demo-doc GIỮ NGUYÊN (PL-9): doc hiện tại đã phủ đủ kịch bản menu (E2/E5 sửa chữ;
//   E3/E4 đổi màu + demo Tầng vì trùng bbox; E6 line đổi stroke; E7 path xoay; E8 image
//   ẩn Đổi màu; E9 repeat; E1 nền kiểm quyết định 1B).
import { useEffect, useState } from 'react'
import type { Patch } from '@/engine/doc.types'
import CommandBar from '@/components/editor/CommandBar'
import QuickMenu, { InlineTextInput } from '@/components/editor/QuickMenu'
import SelectableA4Preview from '@/components/editor/SelectableA4Preview'
import { useEditorStore } from '@/stores/editorStore'

export default function EditorPage() {
  const doc = useEditorStore((s) => s.doc)
  const selectedId = useEditorStore((s) => s.selectedId)
  const past = useEditorStore((s) => s.past)
  const future = useEditorStore((s) => s.future)
  const gestureBaseDoc = useEditorStore((s) => s.gestureBaseDoc)
  const lastSnapshot = useEditorStore((s) => s.snapshots.at(-1) ?? null)
  const setSelection = useEditorStore((s) => s.setSelection)
  const [editingText, setEditingText] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const selected = selectedId === null ? null : (doc.elements.find((el) => el.id === selectedId) ?? null)
  const selectedText = selected !== null && selected.type === 'text' ? selected : null

  const handleApplyPatches = (patches: Patch[]): void => {
    const res = useEditorStore.getState().applyPatches(patches)
    setApplyError(res.skipped.at(-1)?.reason ?? null)
  }

  // Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y (desktop) — dùng getState() trong
  // handler, không subscribe thêm. Guard ô nhập: undo của trình duyệt cho input,
  // KHÔNG phải undo doc.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      if (!e.ctrlKey && !e.metaKey) return // metaKey = Cmd macOS (M1.7, carry-over review M1.6)
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        useEditorStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-8">
      <h1 className="text-2xl font-bold">AI Signboard Studio</h1>
      <p className="mt-1 text-center text-sm text-gray-500">
        Chạm hoặc click vào tờ A4 để chọn phần tử — menu nhanh sửa chữ, đổi màu, đổi tầng,
        kéo di chuyển: mọi thao tác chạy local, không tốn lượt AI
      </p>

      <div
        className={`mt-4 flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-center ${
          selectedId !== null ? 'pb-64 md:pb-0' : 'pb-24 md:pb-0'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          {/* M1.6: hàng nút phiên — phía trên preview (không che tờ A4); khóa khi đang kéo */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={!(past.length > 0 && gestureBaseDoc === null)}
              onClick={() => useEditorStore.getState().undo()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hoàn tác
            </button>
            <button
              type="button"
              disabled={!(future.length > 0 && gestureBaseDoc === null)}
              onClick={() => useEditorStore.getState().redo()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Làm lại
            </button>
            <button
              type="button"
              onClick={() => useEditorStore.getState().saveSnapshot()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Lưu phiên bản
            </button>
            {lastSnapshot !== null && (
              <span className="text-sm text-gray-500">Đã lưu: {lastSnapshot.label}</span>
            )}
          </div>

          <SelectableA4Preview
            doc={doc}
            selectedId={selectedId}
            onSelect={setSelection}
            onApplyPatches={handleApplyPatches}
            onDragBegin={() => useEditorStore.getState().beginGesture()}
            onDragEnd={() => useEditorStore.getState().endGesture()}
          >
            {editingText && selectedText !== null ? (
              <InlineTextInput
                el={selectedText}
                onCommit={(text) => {
                  handleApplyPatches([{ op: 'update', id: selectedText.id, path: 'props.text', value: text }])
                  setEditingText(false)
                }}
                onCancel={() => setEditingText(false)}
              />
            ) : null}
          </SelectableA4Preview>
        </div>

        {/* M1.7 (5A): cột phải dọc — QuickMenu trên, CommandBar dưới. Mobile cả 2 đều
            fixed thoát flow (không ảnh hưởng); PC 2 card xếp dọc giữ layout 2 cột.
            Không chọn element → QuickMenu trả null, CommandBar vẫn chiếm cột
            (sidebar luôn hiện trên PC). */}
        <div className="flex w-full flex-col gap-4 md:w-80">
          {/* key theo id đang chọn → đổi selection reset ô hex/lỗi cũ của menu */}
          <QuickMenu
            key={selectedId ?? 'none'}
            doc={doc}
            selected={selected}
            applyError={applyError}
            onApplyPatches={handleApplyPatches}
            onDeselect={() => setSelection(null)}
            onStartEditText={() => setEditingText(true)}
          />
          <CommandBar />
        </div>
      </div>
    </main>
  )
}
