'use client'

// Trang editor — M1.5 Quick Tap: chọn element (M1.4) + menu 5 chức năng local 0 lượt AI.
//
// - State lift lên trang bằng useState (PL-1 — KHÔNG tạo editorStore sớm, đó là M1.6):
//   `doc` (demoDoc module-const đã parse — mọi biến đổi copy-on-write qua applyPatches,
//   KHÔNG BAO GIỜ mutate; unit test patch-apply đã khóa bằng frozen-input) +
//   `selectedId` + `editingText` + `applyError`.
// - `handleApplyPatches`: chạy engine applyPatches → setDoc bản mới; xóa element đang
//   chọn → tự deselect; skipped cuối → footer menu (không dựng toast system — M4).
// - Layout responsive: mobile cột dọc + QuickMenu bottom-sheet fixed (thêm pb-64 đệm
//   khi đang chọn để sheet không che tờ A4); desktop hàng ngang preview + cột menu.
// - KHÔNG đụng layout.tsx — viewport meta mặc định Next (`width=device-width,
//   initial-scale=1`) đã có; `interactive-widget=resizes-content` hoãn về M1.7.
// - Demo-doc GIỮ NGUYÊN (PL-9): doc hiện tại đã phủ đủ kịch bản menu (E2/E5 sửa chữ;
//   E3/E4 đổi màu + demo Tầng vì trùng bbox; E6 line đổi stroke; E7 path xoay; E8 image
//   ẩn Đổi màu; E9 repeat; E1 nền kiểm quyết định 1B).
import { useState } from 'react'
import type { A4Doc, Patch } from '@/engine/doc.types'
import { applyPatches } from '@/engine/patch-apply'
import QuickMenu, { InlineTextInput } from '@/components/editor/QuickMenu'
import SelectableA4Preview from '@/components/editor/SelectableA4Preview'
import { demoDoc } from './demo-doc'

export default function EditorPage() {
  const [doc, setDoc] = useState<A4Doc>(() => demoDoc)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const selected = selectedId === null ? null : (doc.elements.find((el) => el.id === selectedId) ?? null)
  const selectedText = selected !== null && selected.type === 'text' ? selected : null

  const handleApplyPatches = (patches: Patch[]): void => {
    const res = applyPatches(doc, patches)
    setDoc(res.doc)
    if (res.applied.some((p) => p.op === 'remove' && p.id === selectedId)) setSelectedId(null)
    setApplyError(res.skipped.at(-1)?.reason ?? null)
  }

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-8">
      <h1 className="text-2xl font-bold">AI Signboard Studio</h1>
      <p className="mt-1 text-center text-sm text-gray-500">
        Chạm hoặc click vào tờ A4 để chọn phần tử — menu nhanh sửa chữ, đổi màu, đổi tầng,
        kéo di chuyển: mọi thao tác chạy local, không tốn lượt AI
      </p>

      <div
        className={`mt-4 flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-center ${
          selectedId !== null ? 'pb-64 md:pb-0' : ''
        }`}
      >
        <SelectableA4Preview
          doc={doc}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onApplyPatches={handleApplyPatches}
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

        <div className="w-full md:w-80">
          {/* key theo id đang chọn → đổi selection reset ô hex/lỗi cũ của menu */}
          <QuickMenu
            key={selectedId ?? 'none'}
            doc={doc}
            selected={selected}
            applyError={applyError}
            onApplyPatches={handleApplyPatches}
            onDeselect={() => setSelectedId(null)}
            onStartEditText={() => setEditingText(true)}
          />
        </div>
      </div>
    </main>
  )
}
