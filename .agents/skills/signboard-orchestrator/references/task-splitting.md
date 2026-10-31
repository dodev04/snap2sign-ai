# Task-splitting playbook — tách việc theo milestone (M1–M4)

Nguồn: `docs/ROADMAP.md` (định nghĩa hoàn thành từng mốc là chân lý). Tài liệu này chỉ bổ sung **cách tách gói** cho vừa context và **thứ tự gói** đề xuất.

## Nguyên tắc chung

- Mỗi gói có mục "Định nghĩa xong" riêng, chép từ ROADMAP — subagent chỉ báo xong khi đạt đúng định nghĩa đó.
- Gói chạy song song được khi không đụng cùng file. Gói cùng file → tuần tự.
- Sau mỗi mốc: chạy demo thật theo "Định nghĩa hoàn thành" của mốc trong ROADMAP rồi mới sang mốc sau.

## M1 (Tuần 1–2) — nền editor, chưa có AI

Thứ tự đề xuất (tuần tự trừ 3 gạch dưới song song được):

1. **M1-scaffold** (frontend): Next.js App Router + TS + Tailwind + Zustand, cấu trúc thư mục theo ARCHITECTURE §1. Xong = `npm run dev` chạy, trang editor trống hiện ra. *Sau gói này cập nhật mục build/test trong AGENTS.md.*
2. **M1-types** (engine): `doc.types.ts` + `doc.zod.ts` theo SYSTEM_PROMPTS §6. Xong = Zod parse được 3 doc demo viết tay.
3. **M1-render** (engine): `svg-render.tsx` 6 loại element + hệ tọa độ mm; song song **M1-store** (frontend): `editorStore.ts` undo/snapshot cap 20.
4. **M1-hitest** (frontend): hit-testing pointer→mm, z-order, rotation; kéo-move + resize snap 0.5mm (tự viết pointer events).
5. **M1-quicktap** (frontend): QuickMenu + A4Preview + HighlightOverlay cơ bản.
6. **M1-commandbar** (frontend): CommandBar responsive pill ↔ sidebar, auto-collapse.
7. **M1-demodocs** (engine): 3 doc demo viết tay.

Demo cuối mốc: trên điện thoại thật — chọn dòng giá, sửa số, đổi màu, undo — < 3 giây, 0 lượt AI.

## M2 (Tuần 3–4) — AI engine

1. **M2-api** (backend): `/api/ai/[intent]` Edge + env + BYOK header + rate-limit `ai_usage` qua rpc `count_ai_usage_today`. Không đụng prompt.
2. **M2-prompts** (ai-layer): `prompts.ts` mirror nguyên văn SYSTEM_PROMPTS + `gemini.ts` (responseSchema → Zod → retry ≤1).
3. **M2-hash** (engine): `photo-hash.ts` (chuẩn hóa + SHA-256) — chạy song song với M2-api.
4. **M2-extract** (backend + ai-layer + engine theo interface đã chốt): luồng upload → tra `extraction_cache` → miss thì gọi Gemini Vision → re-id → auto-fit → lưu cache.
5. **M2-edits** (frontend + ai-layer): intent router client, TARGETED/BOARD_EDIT, auto-apply + highlight 1.2s.
6. **M2-autofit** (engine): `autofit.ts` sau `document.fonts.ready`, shrink-to-fit + wrap cân đối.
7. **M2-fonts** (frontend): nhúng 3 font OFL qua `next/font/local`.
8. **M2-test5**: chạy 5 case test chuẩn trong ROADMAP M2 trên ảnh thật.

## M3 (Tuần 5–6) — batch + PDF

1. **M3-batch** (ai-layer): BATCH_EXTRACT prompt + hậu xử lý định dạng giá client.
2. **M3-review** (frontend): `DataReviewTable` + cổng confidence (≤5 item & mọi conf ≥ 0.85 → auto).
3. **M3-paginate** (engine): `repeat-paginate.ts` expand node repeat + grid + tràn trang margin 8mm.
4. **M3-pdf** (engine): `pdf-render.ts` pdf-lib, mm→pt ×2.83465, font subset, primitives.
5. **M3-sync-test** (engine): snapshot test kép — cùng doc qua SVG PNG và PDF render, so khung hình.

## M4 (Tuần 7–8) — kho mẫu + vận hành

1. **M4-library** (frontend): lưới thumbnail + chip filter tags + full-text search.
2. **M4-save** (backend + ai-layer): thumbnail canvas→PNG → Storage `assets`; TAG_TEMPLATE → `templates`.
3. **M4-cron** (backend): `vercel.json` cron `0 6 */3 * *` → `/api/cron/keepalive` Bearer `CRON_SECRET` → rpc `ping`.
4. **M4-byok** (frontend): Settings BYOK (localStorage, validate 1 lượt rẻ), quota UX còn/lượt.
5. **M4-pwa** (frontend): manifest + icon + standalone.
6. **M4-polish** (frontend): empty state, skeleton, toast, test iOS Safari (`100dvh`, keyboard).

## Template prompt subagent (điền và dùng với Agent tool)

```
Bạn là agent phụ trách <domain> của dự án AI Signboard Studio tại D:\image.
1. Đọc D:\image\AGENTS.md, rồi nạp skill .agents/skills/signboard-<domain>/SKILL.md và làm theo nó.
2. Gói việc: <tên gói, vd M2-api>
   - Đầu vào: <những gì đã có từ gói trước — file, interface, kiểu dữ liệu>
   - Việc: <chi tiết từ ROADMAP + skill domain>
   - Định nghĩa xong: <tiêu chí kiểm được từ ROADMAP>
3. Ràng buộc thêm: <nếu có>
4. Cấm mock dữ liệu test; chỉ báo "pass" khi đã chạy lệnh thật và dán output thật.
Trả về: file đã đổi (path + tóm tắt), output test/build thật, các điểm còn mở.
```

## Sa dấu cần nhớ khi điều phối

- Gói `M2-extract` chạm 3 domain → luôn giao SAU khi M2-api, M2-prompts, M2-hash xong, và trong prompt nêu rõ interface 3 gói đó.
- `engine/` là layer thuần duy nhất được unit test không cần luồng thật — các gói engine không đụng Supabase.
- Mọi gói backend test trên Supabase dev (`supabase start` hoặc project dev riêng), tuyệt đối không dùng project production.
