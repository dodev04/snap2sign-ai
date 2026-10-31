---
name: signboard-engine
description: Hướng dẫn implement engine deterministic của AI Signboard Studio — A4Doc schema v1, Zod, patch-apply theo id, auto-fit text, renderer kép SVG/PDF, repeat-paginate, photo-hash. Dùng khi viết/sửa code trong src/engine/, định nghĩa hoặc thêm element type, đổi Document schema, làm renderer/autofit/phân trang, hoặc viết test engine.
---

# Signboard Engine — lõi deterministic (src/engine/)

## Ranh giới tuyệt đối của layer này

`src/engine/` là **thuần deterministic**: không gọi AI, không network, không I/O ngoài đo chữ (`measureText`) và sinh PDF (`pdf-lib`). Lý do: mọi thứ AI dễ sai (tọa độ chính xác, fontSize vừa chữ, chia trang) phải chạy ở đây để chính xác tuyệt đối, lặp lại được và **test được 100%** — đây cũng là layer duy nhất được unit test mà không cần luồng thật (ngoại lệ của quy tắc cấm mock trong AGENTS.md).

Vi phạm ranh giới thường gặp — tránh:
- Đưa logic "đoán" vị trí/fontSize vào `lib/ai/` (AI chỉ khai báo ý định, engine quyết định hình).
- Gọi fetch/Gemini/Supabase trong engine (đó là việc của `lib/ai/`, `lib/db/`).
- Ghép logic vẽ vào type-checking: `doc.zod.ts` chỉ validate, không transform.

## Bản đồ module

| File | Trách nhiệm | Docs đọc trước |
|---|---|---|
| `doc.types.ts` | A4Doc + El types (TS) | ARCHITECTURE §3 |
| `doc.zod.ts` | Schema validate runtime (mirror SYSTEM_PROMPTS §6) | SYSTEM_PROMPTS §6 |
| `patch-apply.ts` | Áp Patch[] theo id + Diff[] + layer-3 check | ARCHITECTURE §4 |
| `autofit.ts` | measureText + binary search fontSize | ARCHITECTURE §6 |
| `svg-render.tsx` | A4Doc → SVG preview | ARCHITECTURE §7, §9 |
| `pdf-render.ts` | A4Doc → PDF (pdf-lib) | ARCHITECTURE §9 |
| `repeat-paginate.ts` | node repeat → N trang | ARCHITECTURE §8 |
| `photo-hash.ts` | chuẩn hóa ảnh + SHA-256 | ARCHITECTURE §10 |

## Quy tắc schema A4Doc (v1)

- Đơn vị **mm tuyệt đối**, khổ A4 210×297, gốc (0,0) góc trên-trái, x → phải, y → xuống.
- `elements` là **flat list** — không lồng nhau.
- Element types cố định: `text | rect | line | image | path | repeat`.
- Field 预留 `dataBinding`, `embedding`, `schemaVersion`: giữ nguyên tên, giữ null ở MVP.
- Thêm element type mới = tăng `schemaVersion` + viết `migrate(oldDoc) -> A4Doc` (chạy lười lúc đọc doc cũ).
- Node `repeat` chỉ xuất hiện sau flow batch; renderer preview render repeat bằng **expand ảo** — không ghi đè vào doc gốc.
- Font token: `body` = Be Vietnam Pro, `display` = Montserrat ExtraBold, `price` = Anton.

## Patch protocol (theo id — không array index)

4 op: `update` (path + value), `add` (id client cấp trước, AI chỉ dùng lại), `remove`, `none` (reason tiếng Việt). Vì sao id thay vì index: AI đếm nhầm index mảng là lỗi phổ biến nhất; id do client quản → sai số 0.

Trong `patch-apply.ts` theo thứ tự ARCHITECTURE §4:
1. Zod validate: id tồn tại (update/remove), path hợp lệ theo loại element, value đúng kiểu.
2. **Layer-3 ngữ cảnh doc**: `update/remove` → id phải có trong doc; `add` → id chưa từng có; `none` → hiển thị reason. Layer-3 fail **không retry** — bỏ op sai, áp phần hợp lệ, trả số N/M cho UI toast.
3. Áp dụng **immutable** (copy-on-write).
4. Trả `Diff[]` = (id, field cũ, field mới) → `HighlightOverlay` nhấp nháy ~1.2s.
5. Đẩy state cũ vào undo stack (cap 20), tạo snapshot nếu lệnh源自 AI.

Quy ước value (Gemini schema không diễn tả "any"): AI điền đúng 1 trong `valueStr`/`valueNum`/`valueBool` theo kiểu của path — engine đọc theo mapping kiểu path (`props.fill`→str, `x`→num...), bỏ qua 2 trường còn lại.

## Auto-fit (`autofit.ts`)

- Chạy **sau** `document.fonts.ready` (chỉ chặn 1 nhịp async duy nhất khi load font).
- Đo bằng `CanvasRenderingContext2D.measureText` — đúng pixel thật của trình duyệt.
- `shrink-to-fit`: binary search fontSize trong [3mm .. h*1.2] sao cho width ≤ w - padding và capHeight ≤ h; kết quả nguyên 0.1mm.
- `wrap` (≤ maxLines): binary search sao cho greedy word-wrap tiếng Việt (giữ nguyên từ có dấu) cho số dòng ≤ maxLines, tổng chiều cao ≤ h; ưu tiên spread đều ký tự/dòng.
- Chữ **không bao giờ tràn khung**; dưới 3mm thì trả cảnh báo đè element cho UI, không tự co tiếp.

## Renderer kép — quy tắc đồng bộ

- Mỗi element type có **cặp hàm `svg(el)` / `pdf(el)` đặt cạnh nhau trong code**. Đổi 1 bên phải đổi bên kia + snapshot test so sánh cùng 1 doc qua cả hai.
- SVG: `viewBox="0 0 210 297"` — tọa độ mm làm đơn vị user, scale bằng CSS → 1 hệ tọa độ cho preview lẫn PDF.
- PDF: trang 595.28 × 841.89 pt; **mm → pt: ×72/25.4 = ×2.83465**. Nhúng font subset từ `/public/fonts` (`embedFont({subset:true})`) 3 file tương ứng 3 token. Path-data parser riêng cho `d` đơn giản: M L C Q Z.
- Rect/Line/Path/Image vẽ bằng primitives pdf-lib trực tiếp.

## repeat-paginate

Input A4Doc (có RepeatEl) + items[] → với mỗi item: clone `itemTemplate.elements`, thay `{{name}}/{{price}}/{{unit}}/{{discount}}`, tính `col = i % cols`, `row = floor(i / cols)`, đặt theo x/y công thức trong ARCHITECTURE §8, auto-fit từng text clone. Tràn trang khi `y + itemH > 297 - 8` → page break, lặp vùng repeat (header trang 1 giữ nguyên). Output `A4Doc[]` → pdf-render gộp 1 file. **Số trang bất kỳ vẫn = 1 lượt AI** — engine không gọi AI.

## photo-hash

`createImageBitmap(file)` → canvas max 1280px (khử EXIF) → `toBlob` → SHA-256 → hex. Hash này là key tra `extraction_cache` (bước tra nằm ở backend, engine chỉ sinh hash).

## Kiểm thử

- Framework: **vitest**. Test engine là unit test thuần — không cần Supabase, không network (nếu test đòi network thì đã viết sai layer).
- Bắt buộc snapshot kép: cùng 1 A4Doc → render SVG ra PNG và render PDF → so khung hình (xem ROADMAP M3).
- Không hardcode dữ liệu giả thay cho dữ liệu thật ở layer khác — ngoại lệ no-mock chỉ dành cho unit test hàm thuần ở đây.

## Trước khi mở PR

- [ ] Không import gì từ `lib/ai/`, `lib/db/`, `stores/` vào engine.
- [ ] Đổi element type/schema → đã tăng `schemaVersion` + viết migrate?
- [ ] Đổi renderer 1 bên → đã đổi cặp bên kia + snapshot test?
- [ ] Đã chạy `npx vitest run` (hoặc lệnh test hiện hành trong AGENTS.md) và dán output thật?
