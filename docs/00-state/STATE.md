# STATE.md — Trạng thái Thực thi Dự án AI Signboard Studio

> Cập nhật sau mỗi task. Không phụ thuộc vào lịch sử chat. File này là Single Source of Truth về tiến độ thực tế của dự án.

## 1. Thông tin chung
- **Dự án**: AI Signboard Studio (D:\image)
- **Mục tiêu**: Web app AI-native chuyển ảnh chụp biển giá thành mẫu in A4 chuẩn vector, sửa bằng conversational editor.
- **Milestone hiện tại**: Milestone 1 (M1) — Core Engine & Data Model (Tuần 1–2).
- **Trạng thái**: M1_IN_PROGRESS (M1.1 + M1.2 đã commit; M1.3 + M1.4 xong — reviewer APPROVE, CHƯA COMMIT; gói kế tiếp: M1.5 Quick Tap).
- **Lần cập nhật cuối**: 2026-11-02

---

## 2. Nhiệm vụ hiện tại (Current Task)
- **Task ID**: 20261102-m14-hit-testing (HOÀN THÀNH 2026-11-02 qua `/pipeline`)
- **Mô tả**: M1.4 — Hit-testing: pointer → tọa độ mm, chọn element theo z-order, hỗ trợ rotation; kèm favicon `src/app/icon.svg` (quyết định 1A). Triển khai: `src/engine/hit-test.ts` (hàm thuần `elementAtPoint(doc, điểm mm)` — sort z desc + tie-break index desc, inverse-rotate quanh tâm bbox, `HIT_TOLERANCE_MM=5` riêng line, repeat trả id cha, bbox khai báo cho mọi type) + 17 unit test; `src/components/editor/SelectableA4Preview.tsx` (client wrapper pointerdown unified → px→mm → engine → viền chọn overlay `#2563EB` pointer-events-none, click-outside deselect, selection state React cục bộ — editorStore để M1.6); `/editor` dùng SelectableA4Preview; demo-doc E7 thêm `rotation:-15`; favicon SVG viết tay (A4 + vạch giá, palette in an toàn).
- **Trạng thái**: DONE — 1 vòng review. Sự cố quy trình: tester lần 1 không ghi `04-test.md` (được spawn lại 1 lần theo cổng bàn giao → thành công); tester lần 2 tạo `verify-playwright.cjs` trong `.handoff/` (vi phạm quyết định 2B) → orchestrator xóa + xác nhận lint exit 0 lại. Tester PASS (vitest 73/73, lint 0, build pass route `/icon.svg`, QA-001 Playwright 2 viewport: DOM-assert 30/30 + 16 PNG evidence, mọi thao tác chọn < 3s) + reviewer **APPROVE** (tự chạy lại toàn bộ lệnh + tự kiểm 16/16 ảnh bằng MD5 + pixel-diff độc lập; 0 blocker, 4 gợi ý không chặn). **CHƯA COMMIT.** Gói kế tiếp: M1.5 Quick Tap.
- **Quyết định chủ sản phẩm (2026-11-02, sau M1.3)**: **1A** — favicon `src/app/icon.svg` đưa vào gói M1.4 (ĐÃ LÀM) · **2B** — xử lý lint carry-over bằng cách xóa file `.cjs` runtime trong `.handoff/` (không thêm eslint globalIgnores); đã xóa `smoke-dev-server.cjs` (M1.2) + 3 script `qa*.cjs` (M1.3) + `verify-playwright.cjs` (M1.4) ⇒ `npm run lint` exit 0 · **3A** (mặc định, không phản đối) — chấp nhận placeholder fontSize heuristic + lệch font metric đến M2.4/M2.5.

---

## 3. Khóa & Ràng buộc (Active Constraints)
1. Vận hành 0đ: Vercel Hobby + Supabase Free + Gemini Free Tier.
2. AI không vẽ — AI khai báo; rendering và layout do deterministic `engine/` xử lý.
3. Patch theo `id` element, không theo index.
4. Renderer kép SVG / PDF đồng bộ hệ mm A4.
5. Cấm mock dữ liệu bừa bãi khi test; test chạm DB phải dùng Supabase dev thật.

