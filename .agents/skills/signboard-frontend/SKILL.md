---
name: signboard-frontend
description: Hướng dẫn implement UI/editor AI Signboard Studio — Next.js App Router, Zustand editorStore (undo/snapshot), A4Preview SVG + hit-testing, Quick Tap menu, CommandBar pill bar ↔ sidebar responsive, auto-apply + highlight diff, DataReviewTable, UX tiếng Việt. Dùng khi đụng src/app/(routes)/, src/components/, src/stores/, sửa trải nghiệm editor, mobile/PC responsive, hoặc wiring client gọi /api/ai/*.
---

# Signboard Frontend — editor UI (src/app/, src/components/, src/stores/)

## Bản đồ cấu trúc

```
src/app/(routes)/editor/ | library/ | settings/     # trang
src/app/api/...                                     # backend — xem skill signboard-backend
src/components/editor/
  A4Preview.tsx        # SVG preview khổ A4, scale responsive
  QuickMenu.tsx        # menu nhanh khi chọn element
  CommandBar.tsx       # 1 component responsive: pill bar mobile ↔ sidebar phải PC
  TrayChips.tsx        # khay chip gợi ý + lịch sử
  DataReviewTable.tsx  # bảng duyệt dữ liệu batch (Excel-lite)
  HighlightOverlay.tsx # nhấp nháy vùng vừa đổi
src/stores/editorStore.ts  # Zustand
```

Ghi nhớ UX đã chốt (PRD §3): pill bar **không che vùng tờ A4**, gửi xong **auto-collapse**; kết quả AI **auto-apply** + highlight + Undo nhanh; Quick Tap sửa chữ là **local — 0 lượt AI**.

## EditorStore (Zustand) — shape chuẩn ARCHITECTURE §5

```ts
interface EditorStore {
  doc: A4Doc
  selectedId: string | null
  past: A4Doc[]      // undo, cap 20
  future: A4Doc[]    // redo
  snapshots: { id: string; label: string; doc: A4Doc; at: number }[]
  lastDiff: Diff[]   // cho HighlightOverlay
  chatContext: { selectedId: string | null; history: { role: 'user'|'ai'; text: string }[] }
  dirty: boolean     // autosave debounce 2s -> upsert templates
}
```

Đẩy state cũ vào undo stack tại `patch-apply` (engine trả Diff); snapshot tự động mỗi lệnh AI; nút "Lưu phiên bản này vào Kho mẫu" bất cứ lúc nào.

## Intent router (client, trước khi gọi API)

- `selectedId !== null` → **TARGETED_EDIT**: gửi element đầy đủ + lệnh + `newElementId` dự phòng (id client cấp — AI không tự chế id).
- `selectedId === null` → **BOARD_EDIT**: gửi bảng thu gọn `{id, type, text≤20 ký tự}` — **không gửi toàn doc** (tiết kiệm token).
- Chip 🎯[element] hiện trong ô input khi đã chọn; lệnh sau đó chỉ áp cho element đó.
- Sau nhận Patch[]: chạy `patch-apply` (engine) → auto-apply → `HighlightOverlay` nhấp nháy ~1.2s → nút Undo nhanh.

## SVG preview + hit-testing (không dùng thư viện drag)

- Preview: `<svg viewBox="0 0 210 297">` — tọa độ mm dùng thẳng, scale bằng CSS.
- Hit-testing: pointerdown → convert clientX/Y → mm: `(clientX - rect.left) / rect.width * 210` → duyệt elements theo **z giảm dần**, bbox chứa điểm; có rotation thì transform ngược điểm trước khi test.
- Move/resize **tự viết bằng pointer events + snap 0.5mm** — không kéo thư viện drag vào. Lý do: cần kiểm soát mm chính xác và khối lượng bundle nhỏ.
- Node `repeat` ở preview: expand ảo để hiển thị, không ghi đè doc gốc.

## Quick Tap menu (0 lượt AI)

Tap chọn element → viền sáng + menu: **Sửa chữ** (inline) / **Đổi màu** (chỉ palette token) / **Xóa** / **Tầng trên-dưới** / "AI sửa mục này". Bốn việc đầu xử lý local qua store + patch-apply, không gọi `/api/ai/*`.

## Batch — cổng confidence + DataReviewTable

- ≤ 5 item và mọi confidence ≥ 0.85 → auto-apply luôn.
- ≥ 6 item hoặc có item yếu → mở bảng **Duyệt dữ liệu** sửa trực tiếp; ô yếu nền vàng.
- Định dạng giá client: `15000 → 15.000đ`; % nguyên số `GIẢM 30%`.
- Sau duyệt: đẩy items vào RepeatEl → `repeat-paginate` (engine) → preview cuộn ngang các trang.

## Ngôn ngữ & thiết kế tiếng Việt

- Giữ nguyên dấu thanh/dấu tiếng Việt mọi chỗ hiển thị; không HOA toàn bộ câu phụ chú.
- Font chỉ OFL qua `next/font/local` 3 file tương ứng token `body`/`display`/`price`.
- Palette in an toàn 8 màu (xem STATIC_PREFIX trong SYSTEM_PROMPTS.md) — color picker chỉ chặn chọn mã ngoài trừ khi user gõ hex cụ thể.

## Mobile / PC / iOS

- CommandBar là **1 component** chia bằng CSS responsive (không viết 2 bản).
- iOS Safari: dùng `100dvh` + `interactive-widget=resizes-content`; keyboard che input là rủi ro đã biết — test thiết bị thật từ M1.
- PWA-lite (M4): manifest + icon + standalone.

## Wiring API + lỗi

- Mọi lệnh AI đi qua `/api/ai/{intent}` (Edge) — client không gọi Gemini, không giữ key.
- Timeout client 25s → toast "AI đang bận, thử lại" — **không auto-retry** ở UI (đốt quota), user bấm gửi lại.
- Toast "Đã áp N/M thay đổi" khi layer-3 bỏ op sai; `none` → hiện reason AI bằng tiếng Việt.
- Quota UX: hiển thị số lượt còn trong ngày; chạm trần → toast + CTA "Dùng key riêng của bạn" (BYOK nhập ở Settings, lưu localStorage).

## Kiểm thử

Test UI chạm dữ liệu chạy **luồng thật trình duyệt → /api/* → Supabase dev** — không stub response, không fake data. Dùng skill browser (control-browser/web-gui-tester) để thao tác GUI thật khi tự động hóa; verify bằng screenshot. Chỉ báo pass khi có bằng chứng chạy thật.
