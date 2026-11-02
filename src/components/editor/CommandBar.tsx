'use client'

/**
 * CommandBar — khung UI lệnh AI (gói M1.7, docs/ROADMAP.md:19; docs/PRD.md:34-35):
 * 1 component responsive chia bằng CSS (skill signboard-frontend:75 — KHÔNG viết
 * 2 bản): mobile = pill bar nổi dưới đáy, focus input mở khay chip (TrayChips);
 * PC = sidebar phải cố định (page.tsx mount dưới QuickMenu trong cột `md:w-80` — 5A).
 *
 * - 1A: gửi được khi chưa có AI (M2) — push `chatContext.history` (role user) qua
 *   action pushChatEntry + auto-collapse khay mobile + ghi chú inline trong khay.
 *   KHÔNG gọi /api/ai/* (M2), KHÔNG deselect sau gửi, 0 lượt AI.
 * - 2A: lịch sử in-memory trong editorStore — KHÔNG localStorage.
 * - 6A: mobile khi QuickMenu bottom-sheet mở, pill nâng lên TRÊN mép sheet — đo
 *   offsetHeight root QuickMenu (`[data-quick-tap-ui][role="toolbar"]`) mỗi khi
 *   selectedId đổi (QuickMenu remount theo key={selectedId} ở page.tsx nên chiều
 *   cao chỉ đổi khi selectedId đổi — đo 1 lần đủ, không cần ResizeObserver) rồi
 *   set inline `bottom`; z-50 > z-40 của sheet.
 * - Q4: KHÔNG hiển thị chip 🎯[element] trong ô input — để dành M2 (TARGETED_EDIT);
 *   selectedId chỉ dùng tính vị trí pill (6A).
 * - "Cao vừa khung, không che vùng tờ A4" (docs/PRD.md:34): khay max-h-[45dvh] +
 *   scroll trong, mobile A4 vẫn thấy phần trên; gửi xong auto-collapse (PRD.md:34,
 *   skill signboard-frontend:23).
 * - Root mang `data-quick-tap-ui="true"` — tap vào bar/khay KHÔNG deselect (phần
 *   tử đang chọn giữ nguyên, SelectableA4Preview loại trừ attribute này).
 */
import { useEffect, useState } from 'react'
import TrayChips from '@/components/editor/TrayChips'
import { useEditorStore } from '@/stores/editorStore'

/** Class nút dùng chung — giống QuickMenu.tsx (light theme, gray-300/gray-700). */
const BTN =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 ' +
  'hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'

export default function CommandBar() {
  const history = useEditorStore((s) => s.chatContext.history)
  // CHỈ dùng tính vị trí pill khi QuickMenu sheet mở (6A) — KHÔNG dùng hiển thị chip 🎯 (Q4).
  const selectedId = useEditorStore((s) => s.selectedId)
  const [value, setValue] = useState('')
  const [expanded, setExpanded] = useState(false) // khay mobile (PC md:block hiển thị luôn)
  const [sheetH, setSheetH] = useState(0) // chiều cao QuickMenu sheet (0 = không mở)

  // 6A: nâng pill lên mép trên QuickMenu sheet khi đang chọn element — xem docblock.
  // Đo trong rAF (sau khi DOM commit QuickMenu theo selectedId mới) — không gọi
  // setState đồng bộ trực tiếp trong effect (rule react-hooks/set-state-in-effect,
  // eslint-config-next 16 bật làm lỗi).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[data-quick-tap-ui][role="toolbar"]')
      setSheetH(el ? el.offsetHeight : 0)
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedId])

  // 1A: gửi = push history (role user) + clear input + auto-collapse khay mobile.
  // KHÔNG deselect, KHÔNG gọi API/fetch — AI thật là M2.
  const submit = (): void => {
    const text = value.trim()
    if (text === '') return
    useEditorStore.getState().pushChatEntry({ role: 'user', text })
    setValue('')
    setExpanded(false)
  }

  return (
    <div
      data-quick-tap-ui="true"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[env(safe-area-inset-bottom)] md:static md:z-auto md:px-0 md:pb-0"
      style={sheetH > 0 ? { bottom: sheetH } : undefined}
    >
      {/* Card: mobile khay nổi trắng để đọc được chip trên nền trang (khớp look-and-feel
          QuickMenu bottom-sheet); PC border card — class md: đúng 02-plan Bước 4. */}
      <div className="rounded-2xl bg-white p-3 shadow-lg md:border md:border-gray-300 md:shadow-none">
        {/* Đóng khay — chỉ mobile (PC khay luôn hiển thị) */}
        {expanded && (
          <div className="mb-1 flex justify-end md:hidden">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Đóng khay lệnh"
              title="Đóng khay lệnh"
              className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Khay chip + lịch sử: mobile mở khi focus input, đóng ✕/sau gửi (1A) */}
        <div className={`${expanded ? '' : 'hidden'} md:block max-h-[45dvh] overflow-y-auto`}>
          <TrayChips history={history} onPick={(text) => setValue(text)} />
        </div>

        {/* Hàng pill — placeholder nguyên văn PRD.md:34 */}
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Sửa bằng AI…"
            aria-label="Ô nhập lệnh AI"
            enterKeyHint="send"
            className="w-full rounded-full border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-600"
            style={{ fontSize: '16px', touchAction: 'manipulation' }} // chống iOS zoom (QuickMenu.tsx:296-298)
          />
          <button type="submit" className={BTN}>
            Gửi
          </button>
        </form>
      </div>
    </div>
  )
}
