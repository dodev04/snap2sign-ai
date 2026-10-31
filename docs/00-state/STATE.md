# STATE.md — Trạng thái Thực thi Dự án AI Signboard Studio

> Cập nhật sau mỗi task. Không phụ thuộc vào lịch sử chat. File này là Single Source of Truth về tiến độ thực tế của dự án.

## 1. Thông tin chung
- **Dự án**: AI Signboard Studio (D:\image)
- **Mục tiêu**: Web app AI-native chuyển ảnh chụp biển giá thành mẫu in A4 chuẩn vector, sửa bằng conversational editor.
- **Milestone hiện tại**: Milestone 1 (M1) — Core Engine & Data Model (Tuần 1–2).
- **Trạng thái**: READY_FOR_SCAFFOLD (Blueprint hoàn chỉnh, chuẩn bị scaffold M1).
- **Lần cập nhật cuối**: 2026-10-31

---

## 2. Nhiệm vụ hiện tại (Current Task)
- **Task ID**: N/A (chờ lệnh `/scaffold M1` hoặc `/pipeline`)
- **Mô tả**: Khởi tạo khung dự án Next.js App Router + TypeScript + Tailwind + Vitest theo `docs/ARCHITECTURE.md §1`.
- **Vai đang chạy**: N/A
- **Trạng thái**: IDLE

---

## 3. Khóa & Ràng buộc (Active Constraints)
1. Vận hành 0đ: Vercel Hobby + Supabase Free + Gemini Free Tier.
2. AI không vẽ — AI khai báo; rendering và layout do deterministic `engine/` xử lý.
3. Patch theo `id` element, không theo index.
4. Renderer kép SVG / PDF đồng bộ hệ mm A4.
5. Cấm mock dữ liệu bừa bãi khi test; test chạm DB phải dùng Supabase dev thật.

