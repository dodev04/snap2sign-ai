# AGENTS.md — AI Signboard Studio (D:\image)

Hướng dẫn cho các ZCode agent làm việc trong workspace này. **Nguồn chân lý là `docs/`** — đọc trước khi sửa vùng nhạy cảm.

## Dự án là gì

Web app (PC + Mobile Web) chuyển **ảnh chụp biển bảng giá siêu thị/tạp hóa** thành **mẫu thiết kế vector chuẩn A4 chuẩn in**, rồi sửa bằng **lệnh tự nhiên** (AI-Native / Conversational Editor — không kéo thả kiểu Canva). Xuất PDF nhiều trang, tạo hàng loạt từ 1 câu lệnh dài, lưu kho mẫu tái sử dụng.

**Ràng buộc kinh doanh cứng:** vận hành **0đ** — Vercel Hobby + Supabase Free + Gemini Free Tier. Mọi thay đổi làm tăng lượt gọi AI hoặc thêm dịch vụ trả phí đều phải hỏi chủ sản phẩm trước.

**Trạng thái:** đã scaffold M1 (khung Next.js 16 + TypeScript + Tailwind v3 + Vitest; 2026-11-02, reviewer APPROVE) — chưa có tính năng. Gói kế tiếp: M1.2 Types + Zod theo `docs/ROADMAP.md`.

## Thư mục

```
docs/               BLUEPRINT — nguồn chân lý, đọc trước khi code
  PRD.md              personas, user flow, success metrics, out-of-scope
  ARCHITECTURE.md     luồng E2E, Document JSON v1, patch protocol, auto-fit,
                      renderer kép, cấu trúc src/ dự kiến (§1)
  DATABASE.md         quy ước truy vấn + giải thích schema
  db/schema.sql       DDL Supabase Postgres (bảng, index, RLS, functions)
  SYSTEM_PROMPTS.md   NGUYÊN VĂN 5 prompt + responseSchema + Zod + retry
  ROADMAP.md          M1-M4 × 2 tuần, định nghĩa hoàn thành, rủi ro
.env.example        7 biến môi trường — placeholder rỗng, không key thật
src/                CODE — đã scaffold M1: app/ (App Router), engine/ (thuần deterministic),
                    lib/ai/, lib/db/, stores/ (Zustand), components/editor/
```

Cấu trúc `src/` theo `docs/ARCHITECTURE.md §1` (Next.js App Router; `engine/` = deterministic thuần, `lib/ai/` = prompts + Gemini client, `stores/` = Zustand). Hiện mới có khung: doc types/Zod (M1.2), renderer (M1.3), store thật (M1.6), AI layer (M2) chưa viết.

## Lệnh build/test

Next.js 16 (App Router, Turbopack) + TypeScript strict + Tailwind v3 + ESLint 10 (flat config) + Vitest:
- `npm run dev` — dev server `http://localhost:3000` (redirect `/` → `/editor`)
- `npm run build` — production build + typecheck
- `npm run lint` — `eslint .`
- `npm run test` (hoặc `npx vitest run`) — unit test hàm thuần trong `src/engine/`

## Kiểm chứng & đồng bộ (bắt buộc mọi phiên làm việc)

1. **Cấm mock dữ liệu test.** Mọi test chạm dữ liệu phải chạy trên luồng thật **client → backend API (`/api/*`) → database (Supabase)** — không stub Supabase, không fake response API, không hardcode dữ liệu giả thay vì query thật. Test tích hợp dùng Supabase dev (local `supabase start` hoặc project dev riêng), không dùng project production. Ngoại lệ duy nhất: unit test hàm thuần trong `engine/` (snapshot `svg(el)`/`pdf(el)` — Nguyên tắc 6) vì layer này không chứa dữ liệu. Cần mock thêm tầng nào khác → hỏi chủ sản phẩm trước.
2. **Cấm bịa thông tin, cấm phán đoán bừa.** Mọi nhận định về schema, API, prompt, hành vi hệ thống phải dựa vào `docs/` hoặc code đã commit — trích dẫn được nguồn. Chưa có trong spec = ghi rõ "spec chưa định nghĩa" rồi hỏi chủ sản phẩm. Chỉ được báo "test/build pass" khi đã chạy lệnh thật và dẫn output thật; không tự tuyên bố thành công khi chưa chạy.
3. **Đồng bộ GitHub đầu mỗi buổi làm việc.** Trước khi code việc mới: `git fetch origin` → so local với `origin/main` (`git status`, `git log HEAD..origin/main`) → nếu tụt sau thì `git pull --rebase` → đọc diff mới kéo về để xác định công việc định làm **có đụng chạm code đã có trên repo không** (đặc biệt `engine/`, prompts mirror, `docs/db/schema.sql`). Có overlap/xung đột làm đổi scope → báo chủ sản phẩm trước khi tiếp tục.
4. **Kỷ luật kiểm chứng Runtime Browser bằng Playwright (QA-001).** Mọi task chạm giao diện người dùng (UI/UX/Editor) **tuyệt đối không được PASS chỉ bằng build hay typecheck**. Tester bắt buộc phải khởi chạy app và dùng **Playwright MCP** chạy kịch bản thật trên trình duyệt (thử nghiệm cả viewport Mobile 390×844 và Desktop 1440×900). Chụp ảnh màn hình lưu vào `.handoff/<task-id>/evidence/` làm bằng chứng khách quan cho Reviewer. Thiếu ảnh chụp browser thật ⇒ kết luận `TEST_RESULT: INCOMPLETE`, reviewer bắt buộc từ chối duyệt (blocker).

## Nguyên tắc kiến trúc (không được phá)

1. **AI KHÔNG vẽ — AI KHAI BÁO.** Thứ AI dễ sai (tọa độ chính xác, fontSize, chia trang) phải chạy trong `engine/` — thuần deterministic, không phụ thuộc AI, không network. Không đưa logic vẽ vào `lib/ai/`, không đưa gọi AI vào `engine/`.
2. **Patch theo `id` element, không bao giờ theo array index** (AI đếm nhầm index). `op:'add'` luôn dùng id **client cấp trước** trong payload — AI không tự chế id.
3. **Element types cố định:** `text | rect | line | image | path | repeat`. Field预留 `dataBinding`, `embedding` và `schemaVersion`: không đổi tên, không xóa, giữ null ở MVP. Đổi schema = tăng `schemaVersion` + viết hàm migrate.
4. **STATIC_PREFIX prompt tĩnh tuyệt đối** (đầu `systemInstruction`, giống hệt 100% lượt gọi — lợi ích implicit context caching). Sửa prompt: chỉnh `SYSTEM_PROMPTS.md` trước, rồi mirror sang code; không chỉnh code prompt trực tiếp.
5. **Bảo đảm 2 lớp:** `responseSchema` (cú pháp) → Zod (giá trị) → retry **tối đa 1 lần**. Lỗi ngữ cảnh doc (id không tồn tại): bỏ op sai, áp phần hợp lệ — không retry.
6. **Renderer kép đồng bộ:** mỗi element type có cặp hàm `svg(el)`/`pdf(el)` cạnh nhau; đổi 1 bên phải đổi bên kia + snapshot test so sánh. Hệ tọa độ mm A4 dùng chung (PDF: mm→pt ×2.83465).
7. **Kỷ luật quota:** batch N trang = 1 lượt AI; Quick Tap sửa chữ/đổi màu = 0 lượt AI; photo-hash cache tra trước mọi lượt EXTRACT. Không thêm lượt gọi AI mới nếu chưa cân nhắc cache/rate-limit (30 lệnh/người/ngày).

## Bảo mật (ràng buộc tuyệt đối khi code)

- **SQL chỉ qua parameter binding** (Supabase client hoặc placeholder `$1,$2`). Cấm nối chuỗi / template string / format SQL với input ngoài.
- **Credentials chỉ từ biến môi trường** (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `IP_HASH_SECRET`...). Không ghi key thật vào source, ví dụ, test, log, hay commit.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng trong API route (server); `extraction_cache`/`ai_usage` không expose cho client (deny-all RLS).
- BYOK key của user: localStorage client, gửi header từng request, server dùng xong **bỏ — không lưu DB, không log**.
- Route `/api/ai/*` chạy Edge Runtime — chỉ `fetch` thuần, không dependency Node-only.

## Pipeline 5 bước (/pipeline) & Lệnh Scaffold (/scaffold)

Mọi việc code chạy qua 5 role tuần tự — **scout → planner → implementer → tester → reviewer** — bàn giao bằng file trong `.handoff/<task-id>/` (`01-scout.md` → `05-review.md`; mẫu tại `.handoff/_templates/`). 
- Định nghĩa role canonical ZCode: `.zcode/agents/<role>.md` (5 vai: `scout`, `planner`, `implementer`, `tester`, `reviewer`).
- Lệnh workflow canonical ZCode: `.zcode/commands/` (`pipeline.md` và `scaffold.md`).
- Trạng thái bền vững của dự án: `docs/00-state/STATE.md` và `docs/00-state/CHECKLIST.md`.
- Chạy: `/pipeline <yêu cầu>` hoặc `/scaffold M1`. Logic vòng lặp (test FAIL ≤ 2 vòng sửa, review REQUEST_CHANGES ≤ 1 vòng, vượt thì dừng) nằm trong lệnh. Planner và implementer **bắt buộc nạp skill domain** (`signboard-*` trong `.agents/skills/`) trước khi làm. Runtime `.handoff/<task-id>/` đã gitignore — chỉ `_templates/` được commit.

## Quy ước khác

- Ngôn ngữ sản phẩm: **tiếng Việt** (giữ nguyên dấu thanh; giá `15.000đ`/`15K`; % nguyên số). Font chỉ dùng OFL: Be Vietnam Pro / Montserrat / Anton (token `body`/`display`/`price`).
- Palette in an toàn + design tokens: xem STATIC_PREFIX trong `docs/SYSTEM_PROMPTS.md`.
- Thảo luận với chủ sản phẩm: mỗi lượt 3-4 câu hỏi kèm 2-3 phương án có ưu/nhược; user trả lời kiểu "1A – 2C".
- Trước khi sửa: prompts → đọc `docs/SYSTEM_PROMPTS.md`; DB → `docs/db/schema.sql` + `docs/DATABASE.md`; engine/renderer → `docs/ARCHITECTURE.md`; roadmap/scope → `docs/ROADMAP.md`.
