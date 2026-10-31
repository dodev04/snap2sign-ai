---
name: signboard-backend
description: Hướng dẫn implement backend AI Signboard Studio — API routes Edge /api/ai/*, cron keepalive, Supabase (4 bảng, RLS, service role), Storage upload, BYOK, rate-limit, bảo mật SQL/credentials. Dùng khi đụng src/app/api/, src/lib/db/, docs/db/schema.sql, truy vấn Supabase, auth/RLS, upload ảnh, cron, hoặc bất kỳ vấn đề bảo mật/phần thưởng phía server nào.
---

# Signboard Backend — API routes + Supabase (src/app/api/, src/lib/db/)

## Ranh giới kỹ thuật

- `/api/ai/*` chạy **Edge Runtime**: chỉ `fetch` thuần tới Gemini, không dependency Node-only (lý do: tránh function timeout gói Vercel Hobby, tối ưu TTFB).
- Credentials **chỉ từ biến môi trường** (xem `.env.example`): `GEMINI_API_KEY`, `GEMINI_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SECRET`, `CRON_SECRET`. Không ghi key thật vào source, test, log, commit.
- Mọi input vào route dùng service role phải được **Zod validate trước khi chạm DB** (service role bypass RLS).

## 4 bảng — ai được truy cập bảng nào

| Bảng | Vai trò | Quyền |
|---|---|---|
| `templates` | 1 row = 1 thiết kế A4 (doc jsonb + tags + thumbnail_path + embedding NULL) | RLS owner-only |
| `snapshots` | bản lưu sau lệnh AI + thủ công | RLS kế thừa qua template cha |
| `extraction_cache` | photo-hash SHA-256 → doc, **dùng chung toàn app** (không theo user) | deny-all client — chỉ service role trong API route |
| `ai_usage` | đếm rate-limit 30 lượt/ngày + monitoring | deny-all client — chỉ service role |

Chi tiết DDL + index + policy: `docs/db/schema.sql`. Đổi schema = sửa file đó trước (nguồn chân lý), giải thích bằng `docs/DATABASE.md`.

## Truy vấn SQL — quy ước bắt buộc

**Chỉ parameter binding.** Cấm nối chuỗi / template string / format SQL với input ngoài — kể cả "chỉ một chỗ nhỏ".

```ts
// ✓ Supabase client (PostgREST tự parameterized)
const { data } = await supabase
  .from('templates')
  .select('id, name, tags, thumbnail_path')
  .contains('tags', [tag])
  .ilike('name', `%${safe}%`)
  .order('updated_at', { ascending: false })

// ✓ raw SQL chỉ qua rpc với tham số đặt tên
const { data } = await supabase.rpc('count_ai_usage_today', { p_user: userId, p_ip_hash: ipHash })

// ✕ Sai tuyệt đối
await supabase.rpc('exec', { sql: `select * from templates where name = '${name}'` })
```

## Các route cần xây + hành vi

### `/api/ai/[intent]` — Edge, intent ∈ extract | targeted-edit | board-edit | batch-extract | tag-template
1. Đọc `GEMINI_API_KEY` + `GEMINI_MODEL` từ env; nhận BYOK ở header `x-byok-key` (nếu có thì dùng key đó cho đúng lượt này rồi **bỏ — không lưu DB, không log**, và không áp rate-limit).
2. Rate-limit: `rpc('count_ai_usage_today', { p_user, p_ip_hash })` — ≥ 30 → 429 + message cho toast CTA BYOK. `ip_hash = SHA-256(ip + IP_HASH_SECRET)` — không lưu IP thô.
3. Gọi tầng `lib/ai/` (prompt + responseSchema + Zod + retry ≤1 — chi tiết ở skill signboard-ai-layer).
4. **EXTRACT:** tra `extraction_cache` theo photo_hash **trước** khi gọi Gemini; miss thì gọi rồi lưu cache. Hit → trả doc, 0 lượt AI.
5. Ghi `ai_usage` mọi lượt (kể cả fail): user_id (nếu đăng nhập) hoặc ip_hash, intent, ok.

### Upload ảnh — route riêng, không cho client dùng service key
Giới hạn type jpeg/png/webp + size ≤ 8MB, **verify magic bytes phía server** trước khi ghi Storage bucket `photos` (private, path `<uid>/<uuid>.jpg`). Thumbnail/font ở bucket `assets` (public đọc).

### `/api/cron/keepalive`
`vercel.json` cron `0 6 */3 * *` → GET với `Authorization: Bearer ${CRON_SECRET}` → `rpc('ping')` (chạy `select 1`). Mục đích: giữ Supabase Free không bị pause.

## Ràng buộc bảo mật rà lại trước khi mở PR

- [ ] Không có chuỗi SQL chứa giá trị người dùng nối trực tiếp.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` chỉ xuất hiện trong API route (server); `extraction_cache`/`ai_usage` không bao giờ expose cho client.
- [ ] BYOK không rơi vào log/DB ở bất kỳ nhánh nào (kể cả error path).
- [ ] Mọi input route đã qua Zod trước khi chạm DB/Storage.
- [ ] Không dependency Node-only trong route Edge.

## Kiểm thử — quy tắc từ AGENTS.md

Test backend phải chạy **luồng thật client → `/api/*` → Supabase dev** (local `supabase start` hoặc project dev riêng): không stub Supabase, không fake response API, không hardcode dữ liệu giả thay query thật. Không dùng project production để test. Chỉ báo "pass" khi có output lệnh thật.

## Ghi chú vận hành

- Cài schema: chạy `docs/db/schema.sql` trong SQL Editor một lần.
- `embedding vector(768)` là placeholder NULL — chỉ bật semantic search khi kho ≥ 30 mẫu (backlog sau MVP); 768 chỉnh được trước khi có dữ liệu.
- Full-text search kho mẫu: index GIN `to_tsvector('simple', name || description)` + chip filter `tags @> ...`.
