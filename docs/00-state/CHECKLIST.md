# CHECKLIST.md — Tiến độ Thực thi Theo Roadmap

> Ghi nhận tiến độ đo lường được theo `docs/ROADMAP.md`. Chỉ tick `[x]` khi đã qua kiểm thử độc lập và reviewer duyệt.

## Milestone 1: Nền Editor, Chưa có AI (Tuần 1-2)
- [x] **M1.1 — Scaffold**: Next.js App Router + TS + Tailwind + Zustand + Vitest; cấu trúc thư mục theo ARCHITECTURE.md §1 *(scaffold-m1 — tester PASS + reviewer APPROVE 2026-11-02)*
- [x] **M1.2 — Types + Zod**: `doc.types.ts` / `doc.zod.ts` — A4Doc + Patch (đúng SYSTEM_PROMPTS.md §6) *(20261102-m12-types-zod — tester PASS 43/43 + smoke 2 viewport, reviewer APPROVE 2026-11-02; 2 câu hỏi mở đã phê chuẩn 1A–2A ngày 2026-11-02: giữ A4DocSchema/ElSchema tổng hợp + cách đọc superRefine add; đã commit ae5f771)*
- [x] **M1.3 — SVG renderer**: `svg-render.tsx` — 6 loại element; hệ tọa độ mm; scale responsive *(20261102-svg-renderer — 2 vòng: vòng 1 REQUEST_CHANGES 1 blocker svgPath stroke-only default fill đen → fix `fill="none"` + test 9b + MIRROR(M3.4); vòng 2 tester PASS 56/56 + QA-001 2 viewport 4 PNG evidence, reviewer APPROVE 2026-11-02. Kèm A4Preview.tsx + demo-doc + /editor hiển thị preview thật. CHƯA COMMIT)*
- [x] **M1.4 — Hit-testing**: pointer → mm; chọn element theo z-order; hỗ trợ rotation *(20261102-m14-hit-testing — `src/engine/hit-test.ts` hàm thuần (z desc + tie-break index desc, inverse-rotate quanh tâm bbox, tolerance ±5mm riêng line) + 17 unit test; `SelectableA4Preview.tsx` pointerdown → mm → viền chọn overlay (không đụng snapshot M1.3); tester PASS (vitest 73/73, lint 0, build pass, QA-001 Playwright 2 viewport 1440×900 + 390×844: DOM-assert 30/30 + 16 PNG evidence, chọn < 3s) + reviewer APPROVE 2026-11-02, 0 blocker. Kèm favicon `src/app/icon.svg` (quyết định 1A — hết 404 /favicon.ico). CHƯA COMMIT)*
- [x] **M1.5 — Quick Tap**: menu: Sửa chữ (inline) / Đổi màu / Xóa / Tầng / kéo-move + resize snap 0.5mm *(20261102-m15-quick-tap — 3 module engine thuần mới + 63 unit test: `snap.ts` (snapMm 0.5 + applyMove/applyResize clamp bound Zod, sàn 0.5/trần 215×302), `selection.ts` (isBackgroundElement theo STATIC_PREFIX:20 + selectableElementAtPoint = điểm triển khai duy nhất quyết định 1B "click nền = deselect"), `patch-apply.ts` (applyPatches 4 op theo id, copy-on-write + Object.freeze, layer-3 skip kèm reason không retry, ElSchema.safeParse từng element + A4DocSchema.parse cuối; zShiftPatches hoán đổi z với kề theo paint order); UI: `QuickMenu.tsx` (5 chức năng + InlineTextInput, bottom-sheet mobile ↔ card desktop), `SelectableA4Preview.tsx` controlled + drag-surface + 4 handle góc pointer-capture (hit-test chỉ pointerdown), `page.tsx` lift doc/selectedId state; 0 đụng schema/renderer/AI, đúng 9 file plan. Tester PASS (vitest 136/136, lint 0, build pass; QA-001 2 viewport 390×844 + 1440×900: 57 DOM assert + 29 PNG evidence — chạy bằng Playwright library trên Chromium thật vì session tester không có Playwright MCP, reviewer已 thẩm định chấp nhận) + reviewer APPROVE 2026-11-02, 0 blocker, 2 việc nên sửa chuyển M1.6 (stopPropagation beginDrag, ngưỡng 1.5mm cho resize). Quyết định orchestrator thay mặt ĐÃ ĐƯỢC CHỦ SẢN PHẨM XÁC NHẬN 2026-11-02 (1B/2A/3A). CHƯA COMMIT)*
- [x] **M1.6 — Undo/Snapshot**: store `past/future` cap 20 + snapshots + nút "Lưu phiên bản" *(20261102-m1-6-undo-snapshot — `src/stores/editorStore.ts` Zustand v5 shape §5 + `gestureBaseDoc` transaction 1C (beginGesture/endGesture: 1 gesture kéo = 1 mục undo; jitter <1.5mm không sinh mục), 8 actions (applyPatches wrapper engine no-op toàn skipped + deselect-on-remove + trả ApplyResult; undo/redo khóa khi gesture + healing selection; saveSnapshot in-memory label `Phiên {n} — HH:MM`; restoreSnapshot undoable); `page.tsx` nâng doc/selectedId lên store + hàng nút Hoàn tác/Làm lại/Lưu phiên bản + Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y guard ô nhập; 2 carry-over M1.5 sửa xong (stopPropagation beginDrag + ngưỡng 1.5mm resize) + 2 props optional onDragBegin/onDragEnd; `vitest.config.ts` alias `@`; `editorStore.test.ts` 12 test engine gọi thật. Đúng 5 file plan, 0 đụng engine. Tester PASS (vitest 148/148, lint 0, build pass; QA-001 2 viewport 20/20 kịch bản + 20 PNG — Playwright library Chromium thật) + reviewer APPROVE 2026-11-02, 0 blocker, 6 gợi ý không chặn (đồng bộ §5 transaction, panel snapshot UI, metaKey Mac, tách demo-doc khỏi app route, đếm ảnh 04-test 18→20). Snapshot in-memory phiên do orchestrator chốt theo ARCHITECTURE §5 + brief. CHƯA COMMIT)*
- [x] **M1.7 — CommandBar**: responsive pill bar + khay chip (mobile) ↔ sidebar phải (PC) *(20261102-m17-command-bar — `CommandBar.tsx` 1 bản responsive CSS: mobile pill nổi đáy `fixed bottom-0 z-50` + khay `TrayChips.tsx` (5 chip gợi ý hardcode bám SYSTEM_PROMPTS :129/:194/:211 + lịch sử mới nhất trên cùng + ghi chú inline "AI sẽ sẵn sàng ở bản sau (M2)", max-h 45dvh không che A4, auto-collapse sau gửi, root `data-quick-tap-ui` không deselect, input 16px chống iOS zoom) ↔ PC sidebar phải trong cột `md:w-80` xếp dưới QuickMenu (5A), pill nâng trên mép QuickMenu sheet qua đo offsetHeight + rAF (6A); wire `chatContext.history` qua action `pushChatEntry` cách ly hoàn toàn khỏi undo stack (no-op text rỗng, không set selectedId) + 5 unit test (tổng 153); carry-over M1.6 metaKey Cmd+Z/Cmd+Shift+Z cạnh Ctrl, guard ô nhập giữ nguyên; `layout.tsx` viewport `interactiveWidget=resizes-content`. Quyết định chủ sản phẩm 1A–2A–5A–6A (gửi được + phản hồi inline, in-memory, cùng cột dưới QuickMenu, pill trên mép sheet). Đúng 6 file plan, 0 đụng engine/API/AI/localStorage/toast. Tester PASS (vitest 153/153, lint 0, build pass, engine diff rỗng; QA-001 Playwright library Chromium thật 2 viewport: 37/37 assert + 16 PNG evidence) + reviewer APPROVE 2026-11-02, 0 blocker, 4 gợi ý không chặn (key={i} TrayChips, sheetH khi resize/orientation — M2; wording chip 4 Q3 duyệt; dọn STATE.md dòng trùng — đã làm). CHƯA COMMIT — commit M1.6 riêng trước, M1.7 riêng sau)*
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

