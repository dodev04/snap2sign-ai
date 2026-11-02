# CHECKLIST.md — Tiến độ Thực thi Theo Roadmap

> Ghi nhận tiến độ đo lường được theo `docs/ROADMAP.md`. Chỉ tick `[x]` khi đã qua kiểm thử độc lập và reviewer duyệt.

## Milestone 1: Nền Editor, Chưa có AI (Tuần 1-2)
- [x] **M1.1 — Scaffold**: Next.js App Router + TS + Tailwind + Zustand + Vitest; cấu trúc thư mục theo ARCHITECTURE.md §1 *(scaffold-m1 — tester PASS + reviewer APPROVE 2026-11-02)*
- [x] **M1.2 — Types + Zod**: `doc.types.ts` / `doc.zod.ts` — A4Doc + Patch (đúng SYSTEM_PROMPTS.md §6) *(20261102-m12-types-zod — tester PASS 43/43 + smoke 2 viewport, reviewer APPROVE 2026-11-02; 2 câu hỏi mở đã phê chuẩn 1A–2A ngày 2026-11-02: giữ A4DocSchema/ElSchema tổng hợp + cách đọc superRefine add; đã commit ae5f771)*
- [x] **M1.3 — SVG renderer**: `svg-render.tsx` — 6 loại element; hệ tọa độ mm; scale responsive *(20261102-svg-renderer — 2 vòng: vòng 1 REQUEST_CHANGES 1 blocker svgPath stroke-only default fill đen → fix `fill="none"` + test 9b + MIRROR(M3.4); vòng 2 tester PASS 56/56 + QA-001 2 viewport 4 PNG evidence, reviewer APPROVE 2026-11-02. Kèm A4Preview.tsx + demo-doc + /editor hiển thị preview thật. CHƯA COMMIT)*
- [x] **M1.4 — Hit-testing**: pointer → mm; chọn element theo z-order; hỗ trợ rotation *(20261102-m14-hit-testing — `src/engine/hit-test.ts` hàm thuần (z desc + tie-break index desc, inverse-rotate quanh tâm bbox, tolerance ±5mm riêng line) + 17 unit test; `SelectableA4Preview.tsx` pointerdown → mm → viền chọn overlay (không đụng snapshot M1.3); tester PASS (vitest 73/73, lint 0, build pass, QA-001 Playwright 2 viewport 1440×900 + 390×844: DOM-assert 30/30 + 16 PNG evidence, chọn < 3s) + reviewer APPROVE 2026-11-02, 0 blocker. Kèm favicon `src/app/icon.svg` (quyết định 1A — hết 404 /favicon.ico). CHƯA COMMIT)*
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

