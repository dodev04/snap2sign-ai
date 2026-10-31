# CHECKLIST.md — Tiến độ Thực thi Theo Roadmap

> Ghi nhận tiến độ đo lường được theo `docs/ROADMAP.md`. Chỉ tick `[x]` khi đã qua kiểm thử độc lập và reviewer duyệt.

## Milestone 1: Nền Editor, Chưa có AI (Tuần 1-2)
- [ ] **M1.1 — Scaffold**: Next.js App Router + TS + Tailwind + Zustand + Vitest; cấu trúc thư mục theo ARCHITECTURE.md §1
- [ ] **M1.2 — Types + Zod**: `doc.types.ts` / `doc.zod.ts` — A4Doc + Patch (đúng SYSTEM_PROMPTS.md §6)
- [ ] **M1.3 — SVG renderer**: `svg-render.tsx` — 6 loại element; hệ tọa độ mm; scale responsive
- [ ] **M1.4 — Hit-testing**: pointer → mm; chọn element theo z-order; hỗ trợ rotation
- [ ] **M1.5 — Quick Tap**: menu: Sửa chữ (inline) / Đổi màu / Xóa / Tầng / kéo-move + resize snap 0.5mm
- [ ] **M1.6 — Undo/Snapshot**: store `past/future` cap 20 + snapshots + nút "Lưu phiên bản"
- [ ] **M1.7 — CommandBar**: responsive pill bar + khay chip (mobile) ↔ sidebar phải (PC)
- [ ] **M1.8 — Doc mẫu**: 3 doc demo viết tay: "CỦ QUẢ giảm 30%", bảng giá 2 cột, banner khai trương

---

## Milestone 2: AI Engine (Tuần 3-4)
- [ ] **M2.1 — API Edge Route**: `/api/ai/[intent]` Edge Runtime; Gemini client; rate-limit 30/ngày
- [ ] **M2.2 — EXTRACT pipeline**: upload ảnh → hash check → Gemini Vision → Zod → retry 1 → auto-fit
- [ ] **M2.3 — TARGETED/BOARD_EDIT**: intent router → patch theo id → HighlightOverlay
- [ ] **M2.4 — Auto-fit**: `autofit.ts` sau `document.fonts.ready`; shrink-to-fit + wrap cân đối
- [ ] **M2.5 — Fonts OFL**: nhúng 3 font (Be Vietnam Pro, Montserrat, Anton)
- [ ] **M2.6 — 5 Test cases chuẩn**: kiểm thử 5 kịch bản ảnh và lệnh sửa

---

## Milestone 3: Batch + PDF (Tuần 5-6)
- [ ] **M3.1 — BATCH_EXTRACT**: 1 câu lệnh dài tách N mặt hàng
- [ ] **M3.2 — Cổng confidence & DataReviewTable**: xem và sửa dữ liệu trước khi sinh trang
- [ ] **M3.3 — Repeat-paginate**: tự động chia trang và ngắt trang margin 8mm
- [ ] **M3.4 — PDF Renderer**: `pdf-lib` vector A4 chuẩn in (mm→pt ×2.83465)
- [ ] **M3.5 — Renderer kép đồng bộ**: snapshot test SVG vs PDF

---

## Milestone 4: Kho Mẫu & Vận hành (Tuần 7-8)
- [ ] **M4.1 — Supabase DB & RLS**: bảng `templates`, `signboards`, `ai_usage`, `extraction_cache`
- [ ] **M4.2 — Template Library**: lưu và tái sử dụng mẫu
- [ ] **M4.3 — Anonymous Session**: lưu tạm localStorage, claim khi đăng nhập
- [ ] **M4.4 — Production Verification**: kiểm thử tải và bảo đảm 0đ

