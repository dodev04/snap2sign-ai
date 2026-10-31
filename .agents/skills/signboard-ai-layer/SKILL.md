---
name: signboard-ai-layer
description: Hướng dẫn implement tầng AI của AI Signboard Studio — lib/ai/prompts.ts (STATIC_PREFIX + 5 intent), lib/ai/gemini.ts (responseSchema → Zod → retry ≤1), intent router, kỷ luật quota 30 lượt/ngày. Dùng khi sửa prompt, thêm/đổi intent, đổi Gemini client, retry logic, intent router client, hoặc đụng rate-limit/BYOK ở tầng gọi AI.
---

# Signboard AI Layer — prompts + Gemini client (src/lib/ai/)

## Quy tắc số 1 — mirror từ docs

`docs/SYSTEM_PROMPTS.md` là **nguồn chân lý**. Code `lib/ai/prompts.ts` copy nguyên văn từ đó. Muốn sửa prompt: chỉnh SYSTEM_PROMPTS.md trước → mirror sang code → chạy 5 case test chuẩn (ROADMAP M2). **Cấm chỉnh prompt trực tiếp trong code.** Lý do: docs là bản review được; code prompt lệch docs là bug im lặng làm chất lượng AI trượt mà không ai biết chỗ nào đổi.

## Cấu trúc mọi lượt gọi

```
systemInstruction = STATIC_PREFIX + '\n\n' + INTENT_BLOCK(intent)
contents          = user contents (do client ghép)
```

- **STATIC_PREFIX tĩnh tuyệt đối** — nguyên vẹn, giống hệt 100% lượt gọi, đặt đầu systemInstruction để hưởng implicit context caching của Gemini (giảm latency các lượt sau). Mỗi thay đổi làm mất cache của toàn bộ user base → thay đổi design token trong prefix = dọn cache + nâng version, không sửa "tương đối".
- STATIC_PREFIX chứa design tokens bắt buộc: 3 font token, palette in an toàn 8 màu (`#FFFFFF #D32F2F #FBC02D #2E7D32 #1565C0 #212121 #FFF3CD #FFF8F0`), hierarchy cỡ chữ, quy tắc tiếng Việt (giá `15.000đ`/`15K`, % nguyên số, giữ dấu thanh).

## 5 intent — khi nào client gọi intent nào

| Intent | Kích hoạt | Payload vào (contents) | Ra | Hậu xử lý client |
|---|---|---|---|---|
| `extract` | upload ảnh, cache miss | ảnh + ghi chú user | A4Doc elements + confidence | re-id (`e1→E01`), z-order, auto-fit, chấm hỏi conf < 0.5 |
| `targeted-edit` | có element chọn (chip 🎯) | element đầy đủ + lệnh + `newElementId` | Patch[] | layer-3, auto-apply, highlight |
| `board-edit` | không chọn element | board thu gọn `{id,type,text≤20}` + lệnh + `newElementId` | Patch[] | layer-3, auto-apply, highlight |
| `batch-extract` | câu lệnh dài | câu tiếng Việt thô | items[] + confidence | định dạng giá, cổng confidence, đẩy RepeatEl |
| `tag-template` | lưu kho mẫu | texts/colors/structure thu gọn | name/description/tags | lưu `templates` |

Intent router chạy **client, trước khi gọi API**: `selectedId !== null` → targeted-edit; `=== null` → board-edit. BOARD_EDIT **không gửi toàn doc** — chỉ bảng thu gọn, tiết kiệm token.

## Chuỗi bảo đảm 3 lớp (thứ tự cố định)

1. **responseSchema** khóa cú pháp JSON ở tầng API (schema từng intent trong SYSTEM_PROMPTS §1–§5 — copy đúng, không tự chế).
2. **Zod** kiểm giá trị (mirror trong engine `doc.zod.ts`, SYSTEM_PROMPTS §6): hex màu, tọa độ trong khổ, id định dạng.
3. **Layer-3 ngữ cảnh doc** trong `patch-apply.ts` (engine): id tồn tại / id chưa dùng.

Retry protocol (tối đa **1 lần**):
```
parse JSON thô fail  → retry 1 lần, đính kèm "Lượt trước sai CÚ PHÁP: <err>. Chỉ trả JSON đúng schema."
Zod fail             → retry 1 lần, đính kèm "Lượt trước sai GIÁ TRỊ: <issues>. Sửa các trường: <paths>."
layer-3 fail         → KHÔNG retry — bỏ op sai, áp phần hợp lệ, toast "Đã áp N/M thay đổi"
hết retry vẫn sai    → trả none + reason thân thiện cho UI
```

- Timeout client 25s (Edge); quá → toast "AI đang bận, thử lại", **không tự retry ở UI** (tránh đốt quota), user bấm gửi lại.
- Quy ước value: với `op:"update"` AI điền đúng 1 trong `valueStr`/`valueNum`/`valueBool` theo kiểu path — quy ước này phải có trong intent block TARGETED/BOARD_EDIT.

## Kỷ luật quota (ràng buộc 0đ)

- Mọi lượt (kể cả fail) đều ghi `ai_usage` để rate-limit công bằng — việc ghi nằm ở backend route, không phải layer này tự ghi.
- Rate limit 30 lệnh/người/ngày (platform key). BYOK bỏ qua limit.
- **Quick Tap** sửa chữ/đổi màu/xóa/tầng = local, 0 lượt AI — đừng thêm lượt gọi cho các việc này.
- Batch N trang = **1 lượt AI duy nhất** (chỉ batch-extract; paginate là engine).
- EXTRACT luôn tra `extraction_cache` trước (theo photo-hash) — trùng thì 0 lượt.
- Muốn thêm bất kỳ lượt gọi AI mới nào → hỏi chủ sản phẩm trước (AGENTS.md Nguyên tắc 7).

## Viết prompt mới / sửa prompt — checklist (SYSTEM_PROMPTS §8)

- [ ] STATIC_PREFIX không đổi (hoặc đã cân nhắc dọn cache + nâng version)
- [ ] Mọi intent vẫn chỉ yêu cầu output JSON, không prose
- [ ] Ví dụ trong prompt ≤ 3 và đúng schema hiện tại
- [ ] responseSchema và Zod mirror cùng được cập nhật
- [ ] Đã chạy 5 case test chuẩn trước khi merge

## Ranh giới layer

- Không đưa logic vẽ/tọa độ/chia trang vào đây — AI chỉ **khai báo** (patch, items, tags); engine deterministic lo phần vẽ.
- Không gọi AI từ engine; không đọc env key ngoài API route (client gọi `/api/ai/*`, không gọi Gemini trực tiếp).
- `lib/ai/gemini.ts` chỉ chạy được từ server (API route Edge); không import vào component.
