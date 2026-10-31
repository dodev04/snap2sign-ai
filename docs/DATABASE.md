# AI SIGNBOARD STUDIO — DATABASE (Supabase Postgres)

**File SQL nguồn:** [`db/schema.sql`](db/schema.sql) · **Nguyên tắc số 1 (bắt buộc):** mọi truy vấn dùng **parameter binding** — không nối chuỗi, không template string, không format SQL với input ngoài.

---

## 1. Tổng quan 4 bảng

| Bảng | Vai trò | Ai được truy cập |
|---|---|---|
| `templates` | Kho mẫu — 1 row = 1 thiết kế A4 (JSON + tags + thumbnail) | **RLS owner-only** |
| `snapshots` | Bản lưu tự động sau mỗi lệnh AI + bản "Lưu phiên bản" thủ công | **RLS** kế thừa qua template |
| `extraction_cache` | Cache Lớp 1 photo-hash — dùng chung toàn app | **Chỉ API route** (service role) — deny-all với client |
| `ai_usage` | Đếm lượt rate-limit + monitoring quota | **Chỉ API route** (service role) — deny-all với client |

Vì sao toọn sizes: mỗi A4Doc JSON chỉ ~5-20KB → 500MB free tier chứa hàng chục nghìn mẫu + snapshot. Ảnh lưu ở **Storage** (1GB), DB chỉ giữ path.

---

## 2. Các quyết định thiết kế đáng chú ý

### 2.1. `extraction_cache` dùng chung, không theo user
Cachehit xảy ra khi **người dùng khác** upload cùng loại biển (siêu thị chuỗi chụp lại mỗi tuần) → tiết kiệm tối đa lượt EXTRACT (lượt đắt nhất). Không có dữ liệu nhạy cảm trong doc (chỉ layout + text biển giá) nên chia sẻ an toàn.

### 2.2. `ip_hash` thay IP thô
`SHA-256(ip + IP_HASH_SECRET)` — đủ để rate-limit, không lưu PII. IP_HASH_SECRET là env var phía server.

### 2.3. `embedding vector(768)` đặt sẵn nhưng NULL
- Bật semantic search (Lớp 2) khi kho ≥ 30 mẫu: chỉ cần `create extension vector` (đã có trong schema) + sinh embedding cho các row cũ bằng 1 job chạy 1 lần
- **768 là placeholder** — chỉnh chiều đúng theo model embedding chọn tại thời điểm bật (trước khi có dữ liệu thì ALTER được, sau đó mới khoá)
- Khi bật: `create index on templates using ivfflat (embedding vector_cosine_ops) with (lists = 100);`

### 2.4. `schema_version` + migrate
Doc JSON có `schemaVersion`. Khi engine nâng schema: viết `migrate(oldDoc) -> A4Doc` chạy lười (lazy) lúc đọc — không cần update hàng loạt DB.

### 2.5. Full-text search tên + mô tả
Index GIN `to_tsvector('simple', name || description)` — dùng cho ô tìm kiếm của kho mẫu MVP (cùng với chip filter `tags @> ...`).

---

## 3. Quy ước truy vấn an toàn (BẮT BUỘC)

### ✓ Đúng — Supabase client (PostgREST, tự parameterized)
```ts
const { data } = await supabase
  .from('templates')
  .select('id, name, tags, thumbnail_path')
  .contains('tags', [tag])          // -> tags @> $1
  .ilike('name', `%${safe}%`)       // PostgREST vẫn bind tham số
  .order('updated_at', { ascending: false })
```

### ✓ Đúng — raw SQL chỉ với placeholder
```ts
const { data } = await supabase.rpc('count_ai_usage_today', {
  p_user: userId,        // bind theo tên — service tự escape
  p_ip_hash: ipHash,
})
```

### ✕ Sai tuyệt đối
```ts
await supabase.rpc('exec', { sql: `select * from templates where name = '${name}'` })
// hoặc bất kỳ chuỗi SQL nào chứa giá trị người dùng nối trực tiếp
```

### Vị trí dùng service role key
Chỉ trong API Routes (`/api/ai/*`, `/api/cron/keepalive`) chạy phía server. Service role bypass RLS — vì vậy mọi input vào các route này phải được **Zod validate trước** khi chạm DB.

---

## 4. Storage buckets

| Bucket | Nội dung | Quyền |
|---|---|---|
| `photos` | Ảnh gốc upload (`<uid>/<uuid>.jpg`) | private — owner đọc/ghi theo prefix uid |
| `assets` | Thumbnail PNG, font OFL | public đọc |

Upload đi qua API route riêng (không dùng client trực tiếp với service key): route kiểm **magic bytes** (jpeg/png/webp) + size ≤ 8MB rồi mới ký URL hoặc ghi Storage.

---

## 5. Script vận hành

- **Cài đặt:** chạy `db/schema.sql` trong SQL Editor (một lần)
- **Giữ DB sống:** Vercel Cron `0 6 */3 * *` → `GET /api/cron/keepalive` (header `Authorization: Bearer ${CRON_SECRET}`) → `rpc('ping')`
- **Sao lưu:** cuối mỗi tuần, Dashboard → Database → Backups (free giữ 7 ngày); hoặc export JSON kho mẫu về máy (nút trong Settings — viết bằng Supabase client, không cần tool ngoài)
