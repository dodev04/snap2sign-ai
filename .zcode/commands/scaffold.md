---
description: Khởi tạo khung dự án Milestone 1 (Next.js 15+ App Router, Tailwind, TypeScript, Vitest, thư mục src/) theo docs/ROADMAP.md và docs/ARCHITECTURE.md
argument-hint: M1 [tuỳ chọn ghi chú]
---

# Lệnh Scaffold Milestone 1 — AI Signboard Studio

Lệnh đặc biệt dùng để khởi tạo mã nguồn ban đầu cho dự án khi chưa có `package.json`. Chạy theo quy trình chuẩn hoá nhưng cho phép bước thiết lập môi trường đầu tiên.

## Quy trình thực hiện:

### Bước 1: Khảo sát Spec
Orchestrator đọc kỹ:
- `docs/ROADMAP.md` (mục Milestone 1: Core Engine & Data Model, tuần 1-2).
- `docs/ARCHITECTURE.md §1` (Cấu trúc thư mục `src/`, `engine/`, `lib/ai/`, `stores/`).
- `AGENTS.md` (Tech stack: Next.js App Router, Tailwind, Supabase client, Vitest, Zustand).

### Bước 2: Thiết lập Task Card Scaffold cho Implementer
Dispatch subagent `implementer` với nhiệm vụ:
1. Tạo `package.json` với các dependencies chuẩn theo spec:
   - `next`, `react`, `react-dom` (Next.js 15+ App Router)
   - `typescript`, `@types/node`, `@types/react`
   - `tailwindcss`, `postcss`, `autoprefixer`
   - `zustand`
   - `@supabase/supabase-js`
   - `vitest` (cho unit test deterministic engine)
   - `zod` (validate schema JSON document)
2. Tạo file cấu hình: `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`.
3. Tạo cấu trúc thư mục rỗng kèm file `.gitkeep` hoặc types ban đầu tại `src/`:
   - `src/app/` (Next.js App Router layout + page cơ bản)
   - `src/engine/` (Deterministic layout engine, Document JSON v1 types)
   - `src/lib/ai/` (Prompts mirror, Gemini client)
   - `src/lib/supabase/` (Supabase client helper)
   - `src/stores/` (Zustand state store)
   - `src/types/` (Document schema, element types)
4. Chạy `npm install` để tạo `package-lock.json` và cài đặt `node_modules`.

### Bước 3: Kiểm thử độc lập (Tester)
Dispatch subagent `tester` chạy các lệnh xác thực:
- `npm run lint` (hoặc kiểm tra cú pháp)
- `npm run build` (kiểm tra typecheck và biên dịch Next.js)
- `npx vitest run` (chạy test khung)

Tester dán log thật vào `.handoff/<task-id>/04-test.md`.

### Bước 4: Thẩm định (Reviewer)
Reviewer đối chiếu diff với `docs/ARCHITECTURE.md §1`. Nếu đạt, kết luận APPROVE.

### Bước 5: Cập nhật Trạng thái
Cập nhật `docs/00-state/STATE.md` và `docs/00-state/CHECKLIST.md` đánh dấu mốc Scaffold M1 hoàn thành.

