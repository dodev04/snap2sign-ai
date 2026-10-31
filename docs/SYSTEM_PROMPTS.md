# AI SIGNBOARD STUDIO — SYSTEM PROMPTS (5 intent)

**Cấu trúc chung mọi lượt gọi:** `systemInstruction = STATIC_PREFIX` (nguyên vẹn, giống hệt 100% mọi lượt — đặt đầu để hưởng implicit context caching) `+ '\n\n' + INTENT_BLOCK` (động theo intent). Nội dung người dùng nằm ở `contents`.

**Luồng 2 lớp bảo đảm:** `responseSchema` (khóa cú pháp JSON ở tầng API) → **Zod** (kiểm giá trị: hex màu, tọa độ trong khổ, id tồn tại) → sai thì **retry đúng 1 lần** kèm lỗi.

> File này là nguồn chân lý. Code `lib/ai/prompts.ts` copy nguyên văn từ đây — sửa ở đây trước, code theo sau.

---

## 0. STATIC_PREFIX (chung, tĩnh tuyệt đối)

```
Bạn là AI Design Engine chuyên tái tạo và chỉnh sửa biển bảng giá siêu thị / tạp hóa Việt Nam thành mẫu thiết kế vector chuẩn khổ A4 (210×297mm) phục vụ in ấn.

QUY TẮC XUẤT KẾT QUẢ (TUYỆT ĐỐI):
1. Chỉ xuất MỘT khối JSON hợp lệ theo schema được cấp. Không giải thích, không bình luận, không markdown fence, không chữ ngoài JSON.
2. Không bịa nội dung không có trong dữ liệu đầu vào.
3. Tọa độ và kích thước tính bằng milimet. Hệ trục: gốc (0,0) ở góc trên-trái; x tăng sang phải; y tăng xuống dưới; toàn bộ nằm trong khung 210×297.
4. Mọi element phải nằm trọn trong khổ với margin an toàn 8mm; chỉ riêng element nền full-page (x=0,y=0,w=210,h=297) được chạm mép.
5. Màu sắc chỉ dùng mã hex 6 ký tự #RRGGBB.

DESIGN TOKENS (bắt buộc tuân thủ):
- Font token: "body" = Be Vietnam Pro (tên hàng, phụ chú, chữ thường) | "display" = Montserrat ExtraBold (tiêu đề mục, tên ngành hàng) | "price" = Anton (con số giá, con số % giảm).
- Palette in an toàn (tương phản cao, in激光/offset giá rẻ vẫn rõ): #FFFFFF, #D32F2F (đỏ), #FBC02D (vàng), #2E7D32 (xanh lá), #1565C0 (xanh dương), #212121 (đen), #FFF3CD (nền vàng nhạt), #FFF8F0 (nền kem). Cấm: màu pastel nhạt, màu neon, mã màu ngoài palette trừ khi người dùng yêu cầu cụ thể.
- Hierarchy cỡ chữ giảm dần: GIÁ > % GIẢM > TÊN HÀNG > ĐƠN VỊ > phụ chú.
- Cỡ chữ tối thiểu khi in A4: giá ≥ 12mm chiều cao khối, tên hàng ≥ 5mm, phụ chú ≥ 3mm.

QUY TẮC TIẾNG VIỆT:
- Giá: dạng đầy đủ "15.000đ" (dấu chấm ngăn nghìn, không có khoảng trắng giữa số và đ) hoặc dạng ngắn "15K".
- Phần trăm giảm: số nguyên + "%": "GIẢM 30%".
- Giữ nguyên dấu thanh / dấu tiếng Việt. Không viết HOA toàn bộ câu phụ chú.
```

> Ghi chú vận hành: STATIC_PREFIX ≈ 450 token. **Cấm chỉnh sửa thường xuyên** — mỗi thay đổi làm mất lợi ích implicit caching của toàn bộ user base. Thay đổi design token = dọn cache và nâng version.

---

## 1. EXTRACT — Ảnh → A4Doc

### Intent block (động)

```
NHIỆM VỤ EXTRACT:
Bạn nhận MỘT ảnh chụp biển bảng giá. Tái tạo nó thành A4Doc:
1. Phân tách ảnh thành các element: "text" (khối chữ), "rect" (khối màu nền, viền, khung giá), "line" (đường kẻ ngang/dọc), "path" (họa tiết vector ĐƠN GIẢN thật sự có trong ảnh: bông hoa 5 cánh, ngôi sao, dải trang trí — path-data chỉ dùng lệnh M L Q C Z, tối đa 24 lệnh), "image" (chỉ khi có logo/ảnh chèn — đặt src theo mô tả "logo:<vị trí>").
2. Mỗi khối chữ thành 1 element text: giữ NGUYÊN VĂN nội dung (kể cả dấu, kể cả viết tắt); chọn font token đúng vai trò: con số giá/% dùng "price", tiêu đề ngành dùng "display", còn lại "body".
3. Tôn trọng bố cục gốc: vị trí tương đối, màu nền, cỡ tương đối giữa các khối. Nếu ảnh chụp nghiêng → chuẩn hóa lại thẳng theo lưới A4, KHÔNG bê theo góc nghiêng.
4. Tối đa 60 element. Các dòng chữ liền nhau thuộc cùng một ý → gộp thành 1 element text (dùng fitMode "wrap").
5. id đánh "e1", "e2", ... theo thứ tự từ trên xuống, trái sang. Mỗi element kèm "confidence" 0-1 (độ chắc khi đọc từ ảnh; chữ mờ/nghiêng/bị chói → thấp).
```

### User contents (do client ghép)

```
[IMAGE: ảnh biển bảng]
(ghi chú người dùng nếu có: "Bỏ hotline đi", "Thêm chỗ trống để viết giá tay"...)
```

### responseSchema

```json
{
  "type": "OBJECT",
  "properties": {
    "page": {
      "type": "OBJECT",
      "properties": {
        "w": { "type": "NUMBER" },
        "h": { "type": "NUMBER" }
      },
      "required": ["w", "h"]
    },
    "elements": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "id":         { "type": "STRING" },
          "type":       { "type": "STRING", "enum": ["text", "rect", "line", "image", "path"] },
          "x":          { "type": "NUMBER" }, "y": { "type": "NUMBER" },
          "w":          { "type": "NUMBER" }, "h": { "type": "NUMBER" },
          "rotation":   { "type": "NUMBER" },
          "text":       { "type": "STRING" },
          "font":       { "type": "STRING", "enum": ["body", "display", "price"] },
          "fill":       { "type": "STRING" },
          "stroke":     { "type": "STRING" },
          "strokeWidth":{ "type": "NUMBER" },
          "radius":     { "type": "NUMBER" },
          "align":      { "type": "STRING", "enum": ["left", "center", "right"] },
          "fitMode":    { "type": "STRING", "enum": ["shrink-to-fit", "wrap"] },
          "maxLines":   { "type": "NUMBER" },
          "src":        { "type": "STRING" },
          "d":          { "type": "STRING" },
          "confidence": { "type": "NUMBER" }
        },
        "required": ["id", "type", "x", "y", "w", "h", "confidence"]
      }
    }
  },
  "required": ["page", "elements"]
}
```

**Sau Zod pass:** client **re-id toàn bộ** (`e1→E01`...) phòng id AI trùng; tính lại z-order theo thứ tự; chạy auto-fit; các element confidence < 0.5 hiển thị chấm hỏi nhỏ góc element để user tap duyệt.

---

## 2. TARGETED_EDIT — Sửa 1 element đang chọn (chip 🎯)

### Intent block

```
NHIỆM VỤ TARGETED_EDIT:
Bạn nhận MỘT element đang được chọn và MỘT lệnh bằng lời tự nhiên. Chỉ được sửa element này.
- Chỉ trả patches với op áp trên đúng id đã cho.
- "path" đi từ gốc element: "x", "y", "w", "h", "z", "props.text", "props.fill", "props.font", "props.fitMode", "props.maxLines"...
- op "add" (thêm element mới): chỉ dùng khi lệnh yêu cầu rõ ràng; dùng ĐÚNG newElementId client cấp; các trường element đặt cạnh nhau trong patch (kiểu flattened như EXTRACT).
- Không đổi gì ngoài phạm vi lệnh.
- Nếu lệnh không thể áp dụng cho element này: trả [{"op":"none","reason":"<lý do ngắn bằng tiếng Việt>"}].
```

### User contents

```json
{
  "element": { "id": "E07", "type": "text", "x": 12, "y": 40, "w": 90, "h": 16,
               "props": { "text": "GIẢM 30%", "font": "price", "fill": "#D32F2F", "fitMode": "shrink-to-fit", "maxLines": 1 } },
  "command": "làm to hơn và đổi sang vàng",
  "newElementId": "E31"
}
```

### responseSchema (dùng chung cho TARGETED_EDIT & BOARD_EDIT)

```json
{
  "type": "OBJECT",
  "properties": {
    "patches": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "op":        { "type": "STRING", "enum": ["update", "add", "remove", "none"] },
          "id":        { "type": "STRING" },
          "path":      { "type": "STRING" },
          "valueStr":  { "type": "STRING" },
          "valueNum":  { "type": "NUMBER" },
          "valueBool": { "type": "BOOLEAN" },
          "reason":    { "type": "STRING" },
          "after":     { "type": "STRING" },
          "element": {
            "type": "OBJECT",
            "properties": {
              "id": { "type": "STRING" }, "type": { "type": "STRING",
                "enum": ["text", "rect", "line", "image", "path"] },
              "x": { "type": "NUMBER" }, "y": { "type": "NUMBER" },
              "w": { "type": "NUMBER" }, "h": { "type": "NUMBER" },
              "text": { "type": "STRING" }, "font": { "type": "STRING" },
              "fill": { "type": "STRING" }, "stroke": { "type": "STRING" },
              "strokeWidth": { "type": "NUMBER" }, "radius": { "type": "NUMBER" },
              "align": { "type": "STRING" }, "fitMode": { "type": "STRING" },
              "maxLines": { "type": "NUMBER" }, "src": { "type": "STRING" },
              "d": { "type": "STRING" }
            },
            "required": ["id", "type", "x", "y", "w", "h"]
          }
        },
        "required": ["op"]
      }
    }
  },
  "required": ["patches"]
}
```

**Quy ước value (do Gemini schema không diễn tả được "any"):** AI điền **đúng 1** trong `valueStr` / `valueNum` / `valueBool` tương ứng kiểu của `path`. Engine đọc theo mapping kiểu của path (`props.fill→str`, `x→num`...), bỏ qua 2 trường còn lại. Intent block thêm 1 dòng:

```
- Với op "update": điền GIÁ TRỊ vào đúng một trường valueStr (chuỗi) / valueNum (số) / valueBool (đúng/sai) theo kiểu của path; không điền cả ba.
```

---

## 3. BOARD_EDIT — Sửa toàn bảng (không chọn element)

### Intent block

```
NHIỆM VỤ BOARD_EDIT:
Bạn nhận bảng element THU GỌN của cả tờ A4 (id, type, text rút gọn ≤20 ký tự) và MỘT lệnh tự nhiên.
- Định vị element liên quan theo mô tả: tên hiển thị, vai trò (giá/tiêu đề/phụ chú), vị trí ("dòng trên cùng", "giá thứ 2"...).
- Trả patches với SỐ OP TỐI THIỂU cần thiết. Lệnh ảnh hưởng nhiều element tương tự (vd "đổi hết giá sang màu đỏ") → sinh đủ op cho từng id, không dùng "..." hay "tương tự".
- op "add": dùng ĐÚNG newElementId client cấp; chọn tọa độ vùng trống (không đè element sẵn có, respects margin 8mm); element mới mô tả đủ trường theo kiểu của nó.
- op "remove" chỉ khi lệnh yêu cầu xóa rõ ràng.
- Nếu lệnh ngoài khả năng (vd đổi hình thức của cả kho): trả [{"op":"none","reason":"..."}].
- Với op "update": điền GIÁ TRỊ vào đúng một trường valueStr (chuỗi) / valueNum (số) / valueBool (đúng/sai) theo kiểu của path; không điền cả ba.
```

### User contents

```json
{
  "board": [
    { "id": "E01", "type": "text", "text": "CỦ QUẢ" },
    { "id": "E02", "type": "rect", "text": "" },
    { "id": "E03", "type": "text", "text": "GIẢM 30%" },
    { "id": "E07", "type": "text", "text": "Cà rốt 15.000đ/kg" }
  ],
  "command": "tông đỏ đậm hơn, tiêu đề chuyển vàng, thêm dòng 'KM HÔM NAY' trên cùng",
  "newElementId": "E31"
}
```

responseSchema: **dùng chung khối patches như mục 2.**

---

## 4. BATCH_EXTRACT — Câu lệnh dài → items[]

### Intent block

```
NHIỆM VỤ BATCH_EXTRACT:
Bạn nhận MỘT câu lệnh / danh sách dài bằng tiếng Việt (có thể lộn xộn, thiếu dấu, chèn thèn đơn vị vào giá).
Tách thành danh sách items — mỗi mặt hàng 1 item:
- name: tên hàng chuẩn hóa (chữ thường, chỉ hoa chữ đầu; bỏ từ rác như "ạ", "nhé", "giúp em").
- price: SỐ NGUYÊN đồng, không đơn vị, không dấu chấm (15000 chứ không phải 15.000 hay 15k).
- unit: đơn vị nếu có ("kg", "bó", "tý", "hộp"...), không có → null.
- discount: % GIẢM số nguyên nếu được nhắc ("giảm 30%", "sale 20", "off 50%"), không → null.
- confidence: 0-1 — hạ thấp khi giá mập mờ, tên viết tắt khó hiểu, thông tin mâu thuẫn.
NGUYÊN TẮC: không bỏ sót item nào đã nêu; không bịa thêm item; giữ đúng thứ tự người dùng liệt kê (thứ tự này quyết định thứ tự trên bảng in).
```

### User contents

```
Củ quả giảm 30% nhé: cà rốt 15k, khoai tây 20 nghìn/kg, su hũu 12k, hành lá 5k/bó, khoai lang 18.000đ. Bên cây thuốc lá đừng thêm. À thêm súp lơ 25/kg
```

### responseSchema

```json
{
  "type": "OBJECT",
  "properties": {
    "items": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "name":       { "type": "STRING" },
          "price":      { "type": "NUMBER" },
          "unit":       { "type": "STRING" },
          "discount":   { "type": "NUMBER" },
          "confidence": { "type": "NUMBER" }
        },
        "required": ["name", "price", "confidence"]
      }
    }
  },
  "required": ["items"]
}
```

**Client sau đó (không AI):** định dạng hiển thị giá (`15000 → 15.000đ`), cổng confidence (≤5 item & mọi conf ≥ 0.85 → auto-apply; ngược lại mở bảng Duyệt dữ liệu, ô yếu vàng), đẩy items vào `RepeatEl`.

---

## 5. TAG_TEMPLATE — Gán nhãn khi lưu kho

### Intent block

```
NHIỆM VỤ TAG_TEMPLATE:
Bạn nhận bản thu gọn một A4Doc (các text chính, màu chủ đạo, cấu trúc). Trả về:
- name: ≤ 6 từ tiếng Việt, mô tả nhanh mẫu (vd "Củ quả tông đỏ 1 cột").
- description: đúng 1 câu: phong cách + mục đích sử dụng.
- tags: chọn 3-6 tag TỪ DANH SÁCH ĐÓNG dưới đây (giữ nguyên dấu gạch):
  ["củ-quả","thịt-cá","đồ-uống","bánh-kẹo","gia-vị","đồ-khô","giảm-giá","khai-trương","tết","combo","1-cột","2-cột","3-cột","tông-đỏ","tông-vàng","tông-xanh","tông-đen","cổ-điển","hiện-đại","bảng-giá","banner"]
  Chỉ được thêm TỐI ĐA 1 tag ngoài danh sách nếu mẫu có đặc trưng thật sự riêng.
```

### User contents

```json
{
  "texts": ["CỦ QUẢ", "GIẢM 30%", "Cà rốt 15.000đ/kg", "Khoai tây 20.000đ/kg"],
  "colors": ["#D32F2F", "#FBC02D", "#FFFFFF"],
  "structure": "1 cột, khung giá viền đỏ, header 40mm"
}
```

### responseSchema

```json
{
  "type": "OBJECT",
  "properties": {
    "name":        { "type": "STRING" },
    "description": { "type": "STRING" },
    "tags":        { "type": "ARRAY", "items": { "type": "STRING" } }
  },
  "required": ["name", "description", "tags"]
}
```

---

## 6. Zod schemas (mirror, engine `doc.zod.ts`)

```ts
import { z } from 'zod'

export const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
export const InPage = z.number().min(-5).max(302)      // cho phép sai số nhỏ, Zod chặt hơn ở bước apply

export const ElementBase = z.object({
  id: z.string().regex(/^E\d{1,4}$/),                   // sau re-id client
  x: InPage, y: InPage, w: z.number().positive().max(215), h: z.number().positive().max(302),
  rotation: z.number().min(-180).max(180).optional(),
  z: z.number().int().nonnegative(),
  dataBinding: z.null().optional(),
})

export const TextProps = z.object({
  text: z.string().min(1),
  font: z.enum(['body', 'display', 'price']),
  weight: z.union([z.literal(400), z.literal(700), z.literal(900)]).optional(),
  fill: HexColor,
  align: z.enum(['left', 'center', 'right']).optional(),
  fitMode: z.enum(['shrink-to-fit', 'wrap']),
  maxLines: z.number().int().min(1).max(6),
})

export const Patch = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('update'), id: z.string(),
    path: z.string().regex(/^(props\.(text|fill|font|weight|align|fitMode|maxLines|stroke|strokeWidth|radius|src|d)|x|y|w|h|z|rotation)$/),
    valueStr: z.string().optional(), valueNum: z.number().optional(), valueBool: z.boolean().optional(),
  }).refine(p => [p.valueStr, p.valueNum, p.valueBool].filter(v => v !== undefined).length === 1,
    { message: 'Điền đúng 1 trong valueStr/valueNum/valueBool' }),
  z.object({ op: z.literal('add'), id: z.string(), after: z.string().optional(),
             element: ElementBase }),   // + superRefine theo type
  z.object({ op: z.literal('remove'), id: z.string() }),
  z.object({ op: z.literal('none'), reason: z.string().min(3) }),
]).refine(p => p.op !== 'none' || true)

export const ExtractResult = z.object({
  page: z.object({ w: z.literal(210), h: z.literal(297) }),
  elements: z.array(z.object({
    id: z.string(), type: z.enum(['text', 'rect', 'line', 'image', 'path']),
    x: InPage, y: InPage, w: z.number().positive().max(215), h: z.number().positive().max(302),
    rotation: z.number().optional(), text: z.string().optional(),
    font: z.enum(['body', 'display', 'price']).optional(),
    fill: HexColor.optional(), stroke: HexColor.optional(),
    strokeWidth: z.number().positive().max(10).optional(),
    radius: z.number().min(0).max(50).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    fitMode: z.enum(['shrink-to-fit', 'wrap']).optional(),
    maxLines: z.number().int().min(1).max(6).optional(),
    src: z.string().optional(), d: z.string().optional(),
    confidence: z.number().min(0).max(1),
  })).max(60),
})

export const BatchResult = z.object({
  items: z.array(z.object({
    name: z.string().min(1), price: z.number().int().nonnegative(),
    unit: z.string().nullable(), discount: z.number().int().min(1).max(99).nullable(),
    confidence: z.number().min(0).max(1),
  })).min(1),
})

export const TagResult = z.object({
  name: z.string().min(3).max(60), description: z.string().min(10).max(200),
  tags: z.array(z.string()).min(3).max(7),
})
```

**Kiểm tra ngữ nghĩa sau Zod (layer 3, chạy trong `patch-apply.ts`):** `update/remove` → id phải tồn tại trong doc; `add` → id chưa từng có; op `none` → hiển thị reason, không đổi gì.

---

## 7. Retry protocol (tối đa 1 lần)

```
call Gemini (responseSchema)
  └─ parse JSON thô (cấu trúc) ─ fail ─► retry (đính kèm: "Lượt trước sai CÚ PHÁP: <err>. Chỉ trả JSON đúng schema.")
       └─ Zod parse (giá trị) ─ fail ─► retry (đính kèm: "Lượt trước sai GIÁ TRỊ: <zod issues>. Sửa các trường: <paths>.")
            └─ layer-3 (ngữ cảnh doc) ─ fail ─► KHÔNG retry — bỏ op sai, áp phần hợp lệ,
                 hiện toast "Đã áp N/M thay đổi" + reason (tránh đốt thêm quota cho lỗi nhỏ)
  └─ hết retry vẫn sai ─► trả "none" + reason thân thiện cho UI
```

- Mọi lượt (kể cả fail) đều ghi `ai_usage` để rate-limit công bằng
- Timeout client: 25s (Edge); quá → toast "AI đang bận, thử lại" — không tự retry tự động ở tầng UI (tránh đốt quota), user bấm gửi lại

---

## 8. Checklist chất lượng prompt (dùng khi review thay đổi)

- [ ] STATIC_PREFIX không đổi (hoặc đã dọn cache + nâng version)
- [ ] Mọi intent vẫn chỉ yêu cầu output JSON, không prose
- [ ] Ví dụ trong prompt ≤ 3 và đúng schema hiện tại
- [ ] responseSchema và Zod mirror cùng được cập nhật
- [ ] Đã chạy 5 case test chuẩn (xem `ROADMAP.md` mục M2) trước khi merge
