# STATE.md — Trạng thái Thực thi Dự án AI Signboard Studio

> Cập nhật sau mỗi task. Không phụ thuộc vào lịch sử chat. File này là Single Source of Truth về tiến độ thực tế của dự án.

## 1. Thông tin chung
- **Dự án**: AI Signboard Studio (D:\image)
- **Mục tiêu**: Web app AI-native chuyển ảnh chụp biển giá thành mẫu in A4 chuẩn vector, sửa bằng conversational editor.
- **Milestone hiện tại**: Milestone 1 (M1) — Core Engine & Data Model (Tuần 1–2).
- **Trạng thái**: M1_IN_PROGRESS (M1.1 Scaffold xong — reviewer APPROVE; gói kế tiếp: M1.2 Types + Zod).
- **Lần cập nhật cuối**: 2026-11-02

---

## 2. Nhiệm vụ hiện tại (Current Task)
- **Task ID**: scaffold-m1 (HOÀN THÀNH 2026-11-02 qua `/scaffold M1`)
- **Mô tả**: Khởi tạo khung Next.js 16 App Router + TS strict + Tailwind v3 + Zustand + Supabase client + Zod + Vitest theo `docs/ARCHITECTURE.md §1`. Handoff `.handoff/scaffold-m1/` (02→05): tester PASS (CLI exit 0 + ảnh Playwright 2 viewport), reviewer APPROVE.
- **Vai đang chạy**: N/A (pipeline đóng)
- **Trạng thái**: DONE — gói kế tiếp đề xuất: M1.2 Types + Zod (`doc.types.ts`/`doc.zod.ts` theo SYSTEM_PROMPTS.md §6)

---

## 3. Khóa & Ràng buộc (Active Constraints)
1. Vận hành 0đ: Vercel Hobby + Supabase Free + Gemini Free Tier.
2. AI không vẽ — AI khai báo; rendering và layout do deterministic `engine/` xử lý.
3. Patch theo `id` element, không theo index.
4. Renderer kép SVG / PDF đồng bộ hệ mm A4.
5. Cấm mock dữ liệu bừa bãi khi test; test chạm DB phải dùng Supabase dev thật.

