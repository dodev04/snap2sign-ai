# STATE.md — Trạng thái Thực thi Dự án AI Signboard Studio

> Cập nhật sau mỗi task. Không phụ thuộc vào lịch sử chat. File này là Single Source of Truth về tiến độ thực tế của dự án.

## 1. Thông tin chung
- **Dự án**: AI Signboard Studio (D:\image)
- **Mục tiêu**: Web app AI-native chuyển ảnh chụp biển giá thành mẫu in A4 chuẩn vector, sửa bằng conversational editor.
- **Milestone hiện tại**: Milestone 1 (M1) — Core Engine & Data Model (Tuần 1–2).
- **Trạng thái**: M1_IN_PROGRESS (M1.1–M1.4 đã commit `aab27a2`; M1.5 Quick Tap xong — reviewer APPROVE, CHƯA COMMIT; gói kế tiếp: M1.6 Undo/Snapshot).
- **Lần cập nhật cuối**: 2026-11-02

---

## 2. Nhiệm vụ hiện tại (Current Task)
- **Task ID**: 20261102-m15-quick-tap (HOÀN THÀNH 2026-11-02 qua `/pipeline`)
- **Mô tả**: M1.5 — Quick Tap: menu Sửa chữ (inline) / Đổi màu (palette token) / Xóa / Tầng / kéo-move + resize snap 0.5mm, kết nối `selectedId` + viền chọn M1.4. Đúng 9 file plan, 0 đụng schema/renderer/AI: engine thuần mới `snap.ts` (snapMm 0.5, applyMove/applyResize clamp bound Zod, sàn 0.5/trần 215×302) + `selection.ts` (isBackgroundElement theo STATIC_PREFIX:20 + selectableElementAtPoint — điểm triển khai duy nhất quyết định 1B) + `patch-apply.ts` (applyPatches 4 op theo id, copy-on-write, layer-3 skip kèm reason không retry, ElSchema.safeParse từng element + A4DocSchema.parse cuối; zShiftPatches hoán đổi z với kề theo paint order) + 63 unit test (tổng 136); UI: `QuickMenu.tsx` (5 chức năng + InlineTextInput; bottom-sheet mobile ↔ card desktop), `SelectableA4Preview.tsx` controlled + drag-surface + 4 handle góc pointer-capture (hit-test chỉ pointerdown), `page.tsx` lift doc/selectedId state.
- **Trạng thái**: DONE — 0 vòng sửa (implement → test PASS → review APPROVE, cả ba lượt đầu). Tester PASS (vitest 136/136, lint 0, build pass; QA-001 2 viewport 57 DOM assert + 29 PNG evidence — Playwright library trên Chromium thật vì session tester không có Playwright MCP; reviewer thẩm định chấp nhận). Reviewer APPROVE 0 blocker; 2 việc nên sửa chuyển M1.6: stopPropagation trong `beginDrag` (bubble đổi selection giữa gesture — SelectableA4Preview.tsx:104), ngưỡng 1.5mm cho resize như move (:163). **CHƯA COMMIT.**
- **Quyết định chủ sản phẩm (2026-11-02): 1B – 2A – 3A ĐÃ ĐƯỢC XÁC NHẬN** (orchestrator chốt thay mặt khi chạy tự trị, chủ sản phẩm phê chuẩn ngay sau đó — code giữ nguyên như triển khai): **1B** click element nền (rect full-page) = deselect — hệ quả: M1.5 không chọn được nền để đổi màu nền (đổi ý sau này → chỉ sửa `selection.ts`); **2A** không nút "AI sửa mục này" trong M1.5 (đến M2); **3A** sửa chữ qua menu → InlineTextInput (không double-tap). Kèm 4 điểm spec-chưa-định-nghĩa planner tự chốt an toàn (xem 02-plan "Câu hỏi mở" mục 3–6).
- **Quyết định chủ sản phẩm (2026-11-02, sau M1.3)**: **1A** — favicon `src/app/icon.svg` đưa vào gói M1.4 (ĐÃ LÀM) · **2B** — xử lý lint carry-over bằng cách xóa file `.cjs` runtime trong `.handoff/` (không thêm eslint globalIgnores); đã xóa `smoke-dev-server.cjs` (M1.2) + 3 script `qa*.cjs` (M1.3) + `verify-playwright.cjs` (M1.4) ⇒ `npm run lint` exit 0 · **3A** (mặc định, không phản đối) — chấp nhận placeholder fontSize heuristic + lệch font metric đến M2.4/M2.5.

---

## 3. Khóa & Ràng buộc (Active Constraints)
1. Vận hành 0đ: Vercel Hobby + Supabase Free + Gemini Free Tier.
2. AI không vẽ — AI khai báo; rendering và layout do deterministic `engine/` xử lý.
3. Patch theo `id` element, không theo index.
4. Renderer kép SVG / PDF đồng bộ hệ mm A4.
5. Cấm mock dữ liệu bừa bãi khi test; test chạm DB phải dùng Supabase dev thật.

