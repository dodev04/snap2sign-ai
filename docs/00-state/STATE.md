# STATE.md — Trạng thái Thực thi Dự án AI Signboard Studio

> Cập nhật sau mỗi task. Không phụ thuộc vào lịch sử chat. File này là Single Source of Truth về tiến độ thực tế của dự án.

## 1. Thông tin chung
- **Dự án**: AI Signboard Studio (D:\image)
- **Mục tiêu**: Web app AI-native chuyển ảnh chụp biển giá thành mẫu in A4 chuẩn vector, sửa bằng conversational editor.
- **Milestone hiện tại**: Milestone 1 (M1) — Core Engine & Data Model (Tuần 1–2).
- **Trạng thái**: M1_IN_PROGRESS (M1.1 + M1.2 xong — reviewer APPROVE; gói kế tiếp: M1.3 SVG renderer).
- **Lần cập nhật cuối**: 2026-11-02

---

## 2. Nhiệm vụ hiện tại (Current Task)
- **Task ID**: 20261102-m12-types-zod (HOÀN THÀNH 2026-11-02 qua `/pipeline`)
- **Mô tả**: M1.2 — tạo 4 file trong `src/engine/`: `doc.types.ts` (TS types nguyên văn ARCHITECTURE §3-§4) + `doc.zod.ts` (mirror nguyên văn SYSTEM_PROMPTS §6 dòng 314-379 + superRefine add + ElSchema/A4DocSchema) + 2 file test (13 + 27 assert). Handoff `.handoff/20261102-m12-types-zod/` (01→05): tester PASS (vitest 43/43, lint 0 lỗi, build strict pass, smoke dev 2 viewport có evidence), reviewer APPROVE (0 blocker). **CHƯA COMMIT.**
- **Vai đang chạy**: N/A (pipeline đóng)
- **Trạng thái**: DONE — 2 câu hỏi mở đã phê chuẩn **1A–2A** (2026-11-02): giữ `A4DocSchema`/`ElSchema` tổng hợp + cách đọc "+ superRefine theo type" như đã implement. Còn chờ: commit M1.2 + quyết định favicon (gộp vào M1.3?). Gói kế tiếp: M1.3 SVG renderer (`svg-render.tsx` 6 loại element theo ROADMAP).

---

## 3. Khóa & Ràng buộc (Active Constraints)
1. Vận hành 0đ: Vercel Hobby + Supabase Free + Gemini Free Tier.
2. AI không vẽ — AI khai báo; rendering và layout do deterministic `engine/` xử lý.
3. Patch theo `id` element, không theo index.
4. Renderer kép SVG / PDF đồng bộ hệ mm A4.
5. Cấm mock dữ liệu bừa bãi khi test; test chạm DB phải dùng Supabase dev thật.

