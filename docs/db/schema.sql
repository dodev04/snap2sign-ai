-- AI SIGNBOARD STUDIO — Supabase Postgres schema v1
-- Chạy trong SQL Editor của Supabase (hoặc supabase db push).
-- Ràng buộc cứng: ứng dụng KHÔNG BAO GIỜ nối chuỗi SQL với input ngoài;
-- mọi truy vấn đều qua Supabase client (tự parameterized) hoặc placeholder $1, $2...

create extension if not exists vector;

-- ============================================================--
-- templates: kho mẫu thông minh (1 row = 1 thiết kế A4)
-- ============================================================--
create table templates (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  doc               jsonb not null,                    -- A4Doc { schemaVersion, page, elements }
  thumbnail_path    text,                              -- path trong Storage bucket 'assets'
  source_photo_path text,                              -- ảnh gốc tham chiếu (provenance)
  tags              text[] not null default '{}',      -- do AI TAG_TEMPLATE gán, chip filter dùng đây
  description       text,                              -- 1 câu mô tả phong cách
  schema_version    int  not null default 1,           -- để migrate doc cũ
  embedding         vector(768),                       -- NULL ở MVP; bật semantic search khi kho >= 30 mẫu
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index templates_tags_gin  on templates using gin (tags);
create index templates_owner_idx on templates (owner);
create index templates_name_fts  on templates using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

-- ============================================================--
-- snapshots: bản lưu tự động sau mỗi lệnh AI (undo xa / nhảy mốc)
-- ============================================================--
create table snapshots (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates (id) on delete cascade,
  doc         jsonb not null,
  label       text,                                    -- vd 'v2 — đổi màu vàng' (AI đặt hoặc tự động)
  created_at  timestamptz not null default now()
);
create index snapshots_template_idx on snapshots (template_id, created_at desc);

-- ============================================================--
-- extraction_cache: Cache Lớp 1 (photo-hash) — key = SHA-256 ảnh chuẩn hóa
-- DÙNG CHUNG toàn app (không theo user) → trùng ảnh người khác cũng hit
-- ============================================================--
create table extraction_cache (
  photo_hash  text primary key,
  doc         jsonb not null,
  created_at  timestamptz not null default now()
);

-- ============================================================--
-- ai_usage: đếm lượt cho rate-limit 30 lệnh/người/ngày + monitoring quota
-- ============================================================--
create table ai_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  ip_hash    text,                                     -- SHA-256(ip + secret) — không lưu IP thô
  intent     text not null,                            -- extract|targeted-edit|board-edit|batch-extract|tag-template
  ok         boolean not null default true,            -- false = đã retry vẫn fail
  created_at timestamptz not null default now()
);
create index ai_usage_user_day_idx on ai_usage (user_id, created_at);
create index ai_usage_ip_day_idx   on ai_usage (ip_hash, created_at);

-- ============================================================--
-- ROW LEVEL SECURITY
-- ============================================================--
alter table templates  enable row level security;
alter table snapshots  enable row level security;
alter table extraction_cache enable row level security;
alter table ai_usage   enable row level security;

-- templates: chủ sở hữu đọc/ghi; người khác không thấy gì
create policy "templates owner all" on templates
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- snapshots: kế thừa quyền qua template cha
create policy "snapshots owner via template" on snapshots
  for all using (
    exists (select 1 from templates t
            where t.id = snapshots.template_id and t.owner = auth.uid())
  ) with check (
    exists (select 1 from templates t
            where t.id = snapshots.template_id and t.owner = auth.uid())
  );

-- extraction_cache & ai_usage: KHÔNG có policy cho client (deny-all).
-- Chỉ API route (service role key, server-side) được truy cập.

-- ============================================================--
-- FUNCTION tiện ích (gọi qua rpc, parameterized)
-- ============================================================--

-- Đếm lượt AI trong hôm nay của 1 user (dùng cho rate-limit)
create or replace function count_ai_usage_today(p_user uuid, p_ip_hash text)
returns bigint language sql security definer stable as $$
  select count(*) from ai_usage
  where created_at >= date_trunc('day', now())
    and ( (p_user is not null and user_id = p_user)
       or (p_user is null and ip_hash = p_ip_hash) );
$$;

-- Giữ DB sống (cron gọi): rẻ nhất có thể
-- Vercel Cron -> /api/cron/keepalive -> rpc('ping')
create or replace function ping() returns void language sql as $$ select 1; $$;

-- ============================================================--
-- STORAGE BUCKETS (tạo bằng Dashboard hoặc SQL)
-- ============================================================--
-- bucket 'photos'   : ảnh gốc user upload    — private,   policy: owner đọc/ghi theo path '<uid>/...'
-- bucket 'assets'   : thumbnail + font tệp   — public đọc
-- Giới hạn: chỉ image/jpeg|png|webp, dung lượng <= 8MB (kiểm cả magic bytes phía server route)
