# AI SIGNBOARD STUDIO — ROADMAP THỰC THI MVP

**4 mốc × 2 tuần (8 tuần).** Mỗi mốc kết thúc bằng một bản demo dùng được thật (không phải "code xong 50%").

---

## M1 (Tuần 1-2) — NỀN EDITOR, CHƯA CÓ AI

**Mục tiêu:** mở app là thấy tờ A4, chọn được element, sửa được bằng Quick Tap — với doc mẫu tự viết. Chứng minh phần deterministic trước, AI ghép sau không phá kiến trúc.

| Việc | Chi tiết |
|---|---|
| Scaffold | Next.js App Router + TS + Tailwind + Zustand; cấu trúc thư mục theo ARCHITECTURE.md §1 |
| Types + Zod | `doc.types.ts` / `doc.zod.ts` — A4Doc + Patch (đúng SYSTEM_PROMPTS.md §6) |
| SVG renderer | `svg-render.tsx` — 6 loại element; hệ tọa độ mm; scale responsive |
| Hit-testing | pointer → mm; chọn element theo z-order; hỗ trợ rotation |
| Quick Tap | menu: Sửa chữ (inline) / Đổi màu (palette token) / Xóa / Tầng / kéo-move + resize snap 0.5mm |
| Undo/Snapshot | store `past/future` cap 20 + snapshots + nút "Lưu phiên bản" |
| CommandBar | 1 component responsive: pill bar + khay chip (mobile) ↔ sidebar phải (PC); auto-collapse sau gửi |
| Doc mẫu | 3 doc demo viết tay: "CỦ QUẢ giảm 30%", bảng giá 2 cột, banner khai trương |

**Định nghĩa hoàn thành:** trên điện thoại thật — chọn 1 dòng giá, sửa số, đổi màu, undo — tất cả < 3 giây, không đụng AI.

---

## M2 (Tuần 3-4) — AI ENGINE

**Mục tiêu:** upload ảnh thật → mẫu A4 xuất hiện; gõ lệnh → auto-apply + highlight + undo.

| Việc | Chi tiết |
|---|---|
| `/api/ai/[intent]` | Edge Runtime; đọc `GEMINI_API_KEY`/`GEMINI_MODEL` env; BYOK header `x-byok-key`; rate-limit 30/ngày qua `ai_usage` |
| EXTRACT pipeline | upload (nén + khử EXIF + SHA-256 client) → tra `extraction_cache` → miss thì gọi Gemini Vision (responseSchema §1) → Zod → retry 1 → re-id + auto-fit |
| TARGETED/BORAD_EDIT | intent router client (chip 🎯 / toàn bảng) → patch theo id → layer-3 check → auto-apply + `HighlightOverlay` nhấp nháy 1.2s |
| Auto-fit | `autofit.ts` sau `document.fonts.ready`; shrink-to-fit + wrap cân đối |
| Fonts | nhúng 3 font OFL (Be Vietnam Pro, Montserrat, Anton) qua `next/font/local` |
| 5 case test chuẩn | (1) ảnh thẳng đủ sáng (2) ảnh nghiêng (3) lệnh targeted đổi màu (4) lệnh board "đổi hết giá sang đỏ" (5) lệnh vô lý → none+reason |

**Định nghĩa hoàn thành:** ảnh biển thật (test 10 ảnh siêu thị khác nhau) → EXTRACT thành công ≥ 8/10 không cần retry; patch apply ≥ 99% sau retry; 1 phiên ≤ 3 lượt AI.

---

## M3 (Tuần 5-6) — BATCH + PDF

**Mục tiêu:** 1 câu dài → N trang → 1 file PDF chuẩn in.

| Việc | Chi tiết |
|---|---|
| BATCH_EXTRACT | prompt §4; định dạng giá client (`15000 → 15.000đ`) |
| Cổng confidence | ≤5 item & conf ≥ 0.85 → auto; ngược lại bảng `DataReviewTable` (sửa inline, ô yếu vàng) |
| repeat-paginate | expand node repeat + grid + tràn trang margin 8mm; preview cuộn ngang |
| pdf-render | `pdf-lib`: A4 595.28×841.89pt, mm→pt ×2.83465; font subset 3 font; rect/line/path primitives |
| Export | 1 file PDF nhiều trang; test in thật trên máy in laser A4 |
| Đồng bộ 2 renderer | test snapshot: cùng doc → SVG PNG và PDF render → so khung hình |

**Định nghĩa hoàn thành:** câu 15 mặt hàng → 3-4 trang PDF < 10 giây (chỉ 1 lượt AI); in thử nét, không tràn chữ, đúng margin.

---

## M4 (Tuần 7-8) — KHO MẪU + VẬN HÀNH

**Mục tiêu:** kho mẫu dùng được, hệ thống tự chạy 0đ, sẵn sàng cho người dùng thật đầu tiên.

| Việc | Chi tiết |
|---|---|
| Library UI | lưới thumbnail; chip filter theo tags + ô search full-text; mở mẫu → editor |
| Lưu kho | thumbnail canvas→PNG → Storage `assets`; TAG_TEMPLATE gán tên/mô tả/tags |
| Cron keepalive | `vercel.json`: cron `0 6 */3 * *` → `/api/cron/keepalive` (Bearer `CRON_SECRET`) → `rpc('ping')` |
| BYOK Settings | ô nhập key (localStorage, validate bằng 1 lượt test rẻ), toggle dùng platform/byok |
| Quota UX | hiển thị số lượt còn trong ngày; chạm trần → toast + CTA BYOK |
| PWA-lite | manifest + icon + standalone — thêm màn hình chính điện thoại |
| Polish | empty states, loading skeleton, error toast chuẩn; test iOS Safari (`100dvh`, keyboard) |

**Định nghĩa hoàn thành:** 2 người dùng thật (1 chị Lan, 1 anh Minh) tự hoàn thành flow full — upload → sửa → batch → in — không cần hướng dẫn.

---

## Sau MVP (backlog ưu tiên)

1. **Mic (Web Speech API)** — SpeechRecognition → text → đẩy vào đúng pipeline chat hiện có (Chrome/Edge Android trước)
2. **Lớp 2 Skeleton reuse** — khớp ảnh mới với kho mẫu qua `embedding` + thumbnail; tiết kiệm 50-80% lượt EXTRACT
3. **Semantic search kho mẫu** — pgvector + Gemini embedding (kho ≥ 30 mẫu)
4. **Bleed mark + khổ A5/A3** cho nhà in offset
5. **Template chia sẻ công khai** (flag `is_public` + lượt dùng) — nền tảng cho growth loop

---

## Rủi ro & dự phòng (theo dõi hàng mốc)

| Rủi ro | Tín hiệu | Dự phòng |
|---|---|---|
| Quota Free Tier cạn giữa ngày | `ai_usage` tăng đột biến, 429 từ Gemini | Giảm limit/người; đẩy mạnh cache; bật CTA BYOK sớm |
| EXTRACT chất lượng thấp với ảnh xấu | tỉ lệ retry cao ở M2 | Thêm bước enhance ảnh client (tăng tương phản) trước khi gửi; guide chụp ảnh trong UI |
| Font metric lệch giữa canvas đo và PDF | chữ PDF tràn/khác preview | test đồng bộ 2 renderer (M3) bằng snapshot; nếu lệch → đo lại bằng fontkit metric |
| Supabase pause dù có cron | DB không phản hồi | kiểm tra lịch pause mới của Supabase; fallback nâng gói Pro $25 khi có người dùng thật |
| iOS Safari quirk pill bar | keyboard che input | `100dvh` + `interactive-widget=resizes-content`; test thiết bị thật từ M1 |
