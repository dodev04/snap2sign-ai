'use client'

/**
 * TrayChips — khay chip gợi ý lệnh + lịch sử gần nhất của CommandBar (gói M1.7,
 * docs/ARCHITECTURE.md §1 liệt kê `TrayChips.tsx`). Khay dùng chung mobile/PC nên
 * tách file riêng để CommandBar không phình (02-plan Bước 3).
 *
 * - Ghi chú inline 1A thường trực: "AI sẽ sẵn sàng ở bản sau (M2). Lệnh của bạn
 *   được ghi lại." — KHÔNG dựng toast system (M4).
 * - 5 chip gợi ý hardcode tiếng Việt (Q3) — wording bám ví dụ lệnh thật trong
 *   docs/SYSTEM_PROMPTS.md (CHỈ ĐỌC làm nguồn, không chỉnh file đó).
 * - Tap chip chỉ ĐIỀN vào input qua onPick — KHÔNG tự gửi (chốt an toàn 02-plan:
 *   chưa có AI ở M1.7).
 * - KHÔNG chip 🎯[element] (Q4 — để nguyên vẹn cho M2 cùng TARGETED_EDIT).
 * - Lịch sử in-memory truyền vào qua props (2A — không localStorage); render mới
 *   nhất trên cùng, không cap số mục (spec chưa định nghĩa — khay có max-h + scroll).
 */

/** Gợi ý lệnh — nguồn từng dòng: docs/SYSTEM_PROMPTS.md (ví dụ lệnh thật trong prompt). */
const SUGGESTIONS = [
  'Làm to hơn và đổi sang vàng', // :129 — ví dụ lệnh TARGETED_EDIT
  'Đổi hết giá sang màu đỏ', // :194 — ví dụ lệnh BOARD_EDIT
  'Tông đỏ đậm hơn', // :211 — ví dụ lệnh BOARD_EDIT (3 ý, tách từng ý làm chip)
  'Tiêu đề chuyển sang vàng', // :211
  "Thêm dòng 'KM HÔM NAY' trên cùng", // :211
] as const

export default function TrayChips({
  history,
  onPick,
}: {
  history: { role: 'user' | 'ai'; text: string }[]
  /** Điền text gợi ý vào ô nhập của CommandBar — KHÔNG gửi (M1.7 chưa có AI). */
  onPick: (text: string) => void
}) {
  return (
    <div>
      {/* (a) Ghi chú inline 1A — thường trực trong khay */}
      <p className="text-xs text-gray-500">AI sẽ sẵn sàng ở bản sau (M2). Lệnh của bạn được ghi lại.</p>

      {/* (b) Gợi ý lệnh — tap chỉ điền vào input, KHÔNG tự gửi */}
      <div className="mt-2">
        <p className="text-xs font-medium text-gray-600">Gợi ý lệnh</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onPick(text)}
              className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700"
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {/* (c) Lệnh gần nhất — rỗng hiện "Chưa có lệnh nào"; có mục: mới nhất trên cùng */}
      <div className="mt-3">
        <p className="text-xs font-medium text-gray-600">Lệnh gần nhất</p>
        {history.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">Chưa có lệnh nào</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {history
              .slice()
              .reverse()
              .map((entry, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="text-gray-500">{entry.role === 'user' ? 'Bạn: ' : 'AI: '}</span>
                  {entry.text}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
