# AI SIGNBOARD STUDIO — ARCHITECTURE (Kiến trúc kỹ thuật MVP)

**Phiên bản:** 1.0 · **Nguyên tắc vàng:** AI KHÔNG vẽ — AI KHAI BÁO. Engine deterministic lo phần vẽ.

---

## 1. Stack tổng thể (Giai đoạn 4 đã chốt)

| Tầng | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind + Zustand** | Deploy Vercel Hobby (0đ) |
| AI Proxy | **API Routes `/api/ai/*` — Edge Runtime** | Tránh function timeout trên gói Hobby, tối ưu TTFB |
| AI Model | **Gemini (Flash) qua Google AI Studio** | Tên model đọc từ env `GEMINI_MODEL` — đổi model không cần deploy |
| DB / Auth / Storage | **Supabase Free Tier** (Postgres + Auth + Storage) | `pgvector` sẵn sàng cho embedding |
| Giữ DB sống | **Vercel Cron `0 6 */3 * *`** → `GET /api/cron/keepalive` | Bảo vệ bằng `CRON_SECRET`; chạy `select 1` |
| PDF | **`pdf-lib` client-side** | Renderer kép, chữ vector, font subset tiếng Việt |

### Cấu trúc thư mục dự kiến

```
src/
  app/
    (routes)/editor/ | library/ | settings/
    api/ai/[intent]/route.ts        # Edge: extract | targeted-edit | board-edit | batch-extract | tag-template
    api/cron/keepalive/route.ts
  components/editor/
    A4Preview.tsx  QuickMenu.tsx  CommandBar.tsx (pill bar + sidebar, 1 component responsive)
    TrayChips.tsx  DataReviewTable.tsx  HighlightOverlay.tsx
  engine/                           # THUẦN DETERMINISTIC — không AI, test được 100%
    doc.types.ts  doc.zod.ts        # A4Doc + Patch schemas
    patch-apply.ts                   # apply Patch[] theo id + trả diff để highlight
    autofit.ts                       # measureText + binary search fontSize
    svg-render.tsx                   # A4Doc -> SVG (preview)
    pdf-render.ts                    # A4Doc -> PDF (pdf-lib), mm->pt
    repeat-paginate.ts               # node repeat -> N trang
    photo-hash.ts                    # chuẩn hóa ảnh + SHA-256
  stores/editorStore.ts              # Zustand: doc, selection, undo stack, snapshots
  lib/ai/prompts.ts                  # STATIC_PREFIX + 5 intent (đồng bộ SYSTEM_PROMPTS.md)
  lib/ai/gemini.ts                   # call + responseSchema + retry
  lib/db/supabase.ts  lib/db/queries.ts  # mọi truy vấn parameterized
```

---

## 2. Luồng dữ liệu End-to-End

```
[1] Chụp/upload ──nén+khử EXIF client──► Supabase Storage
[2] photo-hash (SHA-256) ──tra extraction_cache──trùng──► trả A4Doc (0 lượt AI)
                                        └─không trùng─► /api/ai/extract (Edge)
                                           ──► Gemini Vision ──► responseSchema
                                           ──► Zod (giá trị) ──► retry ≤1 ──► A4Doc ──► lưu cache
[3] A4Doc ──► editorStore (Zustand) ──► SVG Renderer ──► Preview A4 (scale)
[4] Lệnh AI:  pill bar / sidebar ──► intent router ──► /api/ai/{targeted|board}-edit
              ──► Patch[] ──► Zod ──► patch-apply ──► auto-apply + highlight diff + snapshot
[5] Lệnh Quick Tap: sửa chữ/đổi màu/xóa/tầng ──► local, KHÔNG gọi AI
[6] Batch: câu dài ──► /api/ai/batch-extract ──► items[]+confidence ──► cổng confidence
              ──(≥6 item / yếu: bảng Duyệt dữ liệu)──► repeat-paginate ──► N trang
              ──► pdf-render ──► 1 file PDF nhiều trang
[7] Lưu kho: thumbnail (canvas→PNG) + /api/ai/tag-template ──► templates (JSON+tags+embedding预留)
```

---

## 3. Document JSON Schema v1

Đơn vị: **mm tuyệt đối**, khổ A4 210×297, gốc tọa độ (0,0) góc trên-trái, x → phải, y → xuống.

```ts
type ElType = 'text' | 'rect' | 'line' | 'image' | 'path' | 'repeat'

interface BaseEl {
  id: string            // client cấp: 'e1', 'e2'... EXTRACT id do AI đếm, client re-id khi ingest
  x: number; y: number; w: number; h: number   // mm
  rotation?: number     // độ
  z: number             // thứ tự vẽ, lớn = trên
  dataBinding?: null    // 预留 cho binding tương lai — giữ null ở MVP
}

interface TextEl extends BaseEl {
  type: 'text'
  props: {
    text: string
    font: 'body' | 'display' | 'price'   // Be Vietnam Pro | Montserrat ExtraBold | Anton
    weight?: 400 | 700 | 900
    fill: string                         // hex #RRGGBB
    align?: 'left' | 'center' | 'right'
    fitMode: 'shrink-to-fit' | 'wrap'
    maxLines: number                     // wrap: ngắt tối đa N dòng; shrink: luôn 1
  }
}
interface RectEl extends BaseEl { type: 'rect'; props: {
  fill: string; radius?: number; stroke?: string; strokeWidth?: number } }
interface LineEl extends BaseEl { type: 'line'; props: {
  stroke: string; strokeWidth: number } }        // đường ngang/dọc từ (x,y) dài w|h
interface ImageEl extends BaseEl { type: 'image'; props: {
  src: string; fit: 'cover' | 'contain' } }      // src = path trong Supabase Storage
interface PathEl extends BaseEl { type: 'path'; props: {
  d: string; fill?: string; stroke?: string } }  // SVG path-data họa tiết đơn giản
interface RepeatEl extends BaseEl { type: 'repeat'
  dataBinding: { source: 'items' }
  itemTemplate: { h: number; elements: El[] }    // text chứa '{{name}}' '{{price}}' '{{unit}}' '{{discount}}'
  grid: { cols: number; gapX: number; gapY: number }
  overflow: 'paginate'
}

interface A4Doc {
  schemaVersion: 1
  page: { w: 210; h: 297; unit: 'mm' }
  elements: El[]                        // KHÔNG lồng nhau — flat list
}
```

**Quy ước纪律 schema:**
- Field预留 (`dataBinding`, `embedding`) giữ rỗng/null đến khi bật tính năng — không xóa, không đổi tên
- Thêm element type mới = tăng `schemaVersion` + viết hàm migrate: `migrate(oldDoc) -> A4Doc`
- Repeat node chỉ xuất hiện sau flow batch; renderer preview render repeat bằng cách **expand ảo** (không ghi đè vào doc gốc)

---

## 4. Patch Protocol (theo id — không array index)

```ts
type Patch =
  | { op: 'update'; id: string; path: string; value: unknown }  // path: 'props.fill' | 'x' | 'w'...
  | { op: 'add';    id: string; after?: string; element: El }   // id do CLIENT cấp trước, AI chỉ dùng lại
  | { op: 'remove'; id: string }
  | { op: 'none';   reason: string }                             // AI từ chối khéo + lý do tiếng Việt
```

**Vì sao id thay vì index:** AI đếm nhầm index mảng là lỗi phổ biến nhất; id 2 ký tự do client quản → sai số = 0. Lệnh `add` luôn kèm id client cấp trong payload (AI không tự chế → không trùng).

**`patch-apply.ts`:**
1. Validate bằng Zod: id phải tồn tại (update/remove), path hợp lệ theo loại element, value đúng kiểu
2. Áp dụng immutable (copy-on-write)
3. Trả về `Diff[]` = danh sách (id, field cũ, field mới) → đẩy cho `HighlightOverlay` nhấp nháy ~1.2s
4. Đẩy state cũ vào undo stack (cap 20), tạo snapshot nếu lệnh源自 AI

---

## 5. State Management (Zustand)

```ts
interface EditorStore {
  doc: A4Doc
  selectedId: string | null
  past: A4Doc[]          // undo, cap 20
  future: A4Doc[]        // redo
  snapshots: { id: string; label: string; doc: A4Doc; at: number }[]
  lastDiff: Diff[]       // cho highlight
  chatContext: { selectedId: string | null; history: { role: 'user'|'ai'; text: string }[] } // gửi kèm intent
  dirty: boolean         // autosave debounce 2s -> upsert templates
}
```

**Intent router** (client, trước khi gọi API):
- `selectedId !== null` → `TARGETED_EDIT`, payload gồm element đầy đủ + lệnh + `newElementId` dự phòng
- `selectedId === null` → `BOARD_EDIT`, payload gồm bảng element thu gọn: `{id, type, text≤20 ký tự}` — **không gửi toàn doc** (tiết kiệm token)

---

## 6. Auto-fit Text Engine (`autofit.ts`)

Chạy **sau** `document.fonts.ready` (chặn 1 nhịp async duy nhất khi load font).

```
shrink-to-fit (1 dòng):
  binarySearch fontSize trong [3mm .. h*1.2]:
    fontSize sao cho measureText(text, font, fontSize).width ≤ w - padding
    và capHeight ≤ h. Kết quả fontSize tối ưu nguyên 0.1mm.

wrap (tối đa maxLines):
  binarySearch fontSize sao cho:
    tồn tại cách ngắt từ (greedy word-wrap tiếng Việt, giữ nguyên từ có dấu)
    mà số dòng ≤ maxLines và tổng chiều cao dòng ≤ h.
  Ngắt dòng cân đối: ưu tiên spread đều số ký tự/dòng (không để dòng cuối 1 từ lép vế).
```

- Đo bằng `CanvasRenderingContext2D.measureText` — đúng pixel thật của trình duyệt
- Chữ **không bao giờ tràn khung** — hết chỗ thì co fontSize, tối thiểu 3mm (nhỏ hơn → cảnh báo đè lên element trong UI)

---

## 7. SVG Renderer + Hit-testing

- `svg-render.tsx`: A4Doc → `<svg viewBox="0 0 210 297">` — tọa độ mm dùng thẳng làm đơn vị user, scale tự nhiên bằng CSS. 1 hệ tọa độ cho preview lẫn PDF → không lệch
- **Hit-testing:** pointerdown → convert clientX/Y → mm (`(clientX - rect.left) / rect.width * 210`) → duyệt elements theo z giảm dần, bbox chứa điểm (kể cả rotation — transform ngược điểm trước khi test)
- Element chọn: viền sáng + handle menu Quick Tap. **Không dùng thư viện drag** — tự viết move/resize bằng pointer events + snap 0.5mm

---

## 8. Node `repeat` + Phân trang (`repeat-paginate.ts`)

```
input:  A4Doc (có RepeatEl) + items[]
expand: với mỗi item i:
          clone itemTemplate.elements, thay {{field}} bằng giá trị item[i]
          tính vị trí: col = i % cols; row = floor(i / cols)
          x = repeatEl.x + col * (itemW + gapX); y = repeatEl.y + row * (itemH + gapY)
          auto-fit từng text clone
tràn trang: khi y + itemH > 297 - margin 8mm:
          page break → trang mới, lặp lại vùng repeatEl (header/trang trí trang 1 giữ nguyên)
output: A4Doc[] (mảng trang) -> pdf-render gộp thành 1 PDF
```

- **Số trang bất kỳ vẫn = 1 lượt gọi AI** (chỉ BATCH_EXTRACT là gọi AI)
- Preview hiển thị dạng cuộn ngang các trang / chuyển trang

---

## 9. Renderer kép PDF (`pdf-render.ts`)

- Cùng A4Doc → `pdf-lib`: tạo trang 595.28 × 841.89 pt; **mm → pt: ×72/25.4 = ×2.83465**
- Text: nhúng font subset (`.ttf` OFL tải từ `/public/fonts`, `embedFont({subset:true})`) — 3 font token tương ứng 3 file
- Rect/Line/Path/Image: vẽ trực tiếp primitives pdf-lib (path-data parser riêng cho `d` đơn giản: M L C Q Z)
- Kết quả: **chữ vector nét ở mọi DPI**, file ~200-500KB/10 trang
- Ràng buộc đồng bộ 2 renderer: mỗi element type có 1 cặp hàm `svg(el)` / `pdf(el)` cạnh nhau trong code + test snapshot chụp cùng 1 doc qua cả hai

---

## 10. Cache & Chi phí (0đ)

### Lớp 1 — Photo-hash cache (MVP)
1. Client: `createImageBitmap(file)` → vẽ canvas max 1280px (khử EXIF) → `toBlob` → SHA-256 → hex
2. Tra `extraction_cache` (chỉ qua API route, service role)
3. Trùng → trả doc, **0 lượt AI**; không trùng → gọi EXTRACT rồi lưu cache

### Prefix tĩnh — Implicit Context Caching
- `STATIC_PREFIX` (xem SYSTEM_PROMPTS.md) **nguyên vẹn, giống hệt mọi lượt, đặt đầu systemInstruction**
- Gemini tự áp implicit caching cho prefix lặp lại → giảm latency các lượt sau

### Kiểm soát quota
- Rate limit **30 lệnh AI/người/ngày** (platform key) — đếm trong `ai_usage` theo user (đã đăng nhập) hoặc ip_hash
- BYOK: user nhập key riêng trong Settings → key lưu **localStorage**, gửi kèm header `x-byok-key` từng request → Edge dùng cho đúng lượt đó rồi **bỏ, không log, không lưu DB** → không áp rate limit
- Chạm trần → toast thân thiện + CTA "Dùng key riêng của bạn"

---

## 11. Bảo mật (ràng buộc cứng khi code)

1. **SQL:** mọi truy vấn dùng **parameter binding** — Supabase client tự tham số hóa; nếu raw SQL (`supabase.rpc`/`select`) thì bắt buộc placeholder `$1, $2...`. **Cấm** nối chuỗi / template string / format SQL với input ngoài
2. **Credentials:** chỉ đọc từ env var (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`...). Không ghi key thật vào source, example, test, log. `.env.example` chỉ chứa placeholder rỗng
3. **RLS:** `templates`/`snapshots` bật RLS owner-only; `extraction_cache`/`ai_usage` chỉ truy cập qua service role trong API route (không expose client)
4. **Edge Runtime:** các route AI chỉ dùng `fetch` thuần tới Gemini — không dependency Node-only
5. Upload ảnh: giới hạn type (jpeg/png/webp) + size ≤ 8MB, verify bằng magic bytes phía server trước khi lưu Storage
