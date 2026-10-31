---
name: signboard-orchestrator
description: Điều phối mọi công việc phát triển AI Signboard Studio (D:\image) — phân loại yêu cầu theo domain, tách thành các gói việc vừa một context, giao subagent đúng skill domain để không nhồi quá nhiều vào một context. Dùng khi nhận bất kỳ việc code/plan/scaffold/fix mới của dự án này, khi việc đụng nhiều tầng (engine + AI + DB + UI), khi cần chia việc cho agent, hoặc khi không chắc triển khai theo ROADMAP từ đâu.
---

# Signboard Orchestrator — điều phối phát triển AI Signboard Studio

Bạn đang là **điều phối viên**, không phải người code chi tiết. Việc của bạn: hiểu yêu cầu → xác định domain → tách gói việc vừa context → giao đúng skill domain → kiểm chứng kết quả theo ràng buộc dự án. Skill domain sẽ lo chi tiết kỹ thuật; đừng tái tạo nội dung của chúng ở đây.

## Bước 0 — đồng bộ và xác định phạm vi (mọi phiên)

1. `git fetch origin` → so `git status` + `git log HEAD..origin/main`. Tụt sau thì `git pull --rebase` rồi đọc diff mới để xem việc định làm có đụng code đã có chưa.
2. `docs/` là **nguồn chân lý** — mọi nhận định về schema, prompt, hành vi phải trích được từ docs hoặc code đã commit. Chưa có trong spec = ghi rõ "spec chưa định nghĩa" rồi hỏi chủ sản phẩm, không tự bịa.
3. Xác định yêu cầu thuộc gói nào (xem bảng định tuyến dưới). Việc chưa rõ scope → hỏi lại trước khi code.

## Bảng định tuyến domain

| Domain | Skill cần nạp | Phạm vi code | Docs bắt buộc đọc trước |
|---|---|---|---|
| Engine deterministic | `signboard-engine` | `src/engine/**` | ARCHITECTURE §3–§9, SYSTEM_PROMPTS §6 |
| Tầng AI (prompt/Gemini) | `signboard-ai-layer` | `src/lib/ai/**` | SYSTEM_PROMPTS toàn bộ |
| Backend (API/DB/Storage) | `signboard-backend` | `src/app/api/**`, `src/lib/db/**` | ARCHITECTURE §10–§11, DATABASE.md, db/schema.sql |
| Frontend (editor UI) | `signboard-frontend` | `src/app/(routes)/**`, `src/components/**`, `src/stores/**` | ARCHITECTURE §5, §7, PRD §3–§4 |

Việc đụng **nhiều domain** (vd "làm flow EXTRACT từ upload đến preview") → tách thành từng gói theo bảng trên, mỗi gói một context/subagent. Việc **scaffold** theo milestone → đọc `references/task-splitting.md` có sẵn bảng tách M1–M4.

## Nguyên tắc tách gói việc (tối ưu context)

- **1 gói = 1 domain.** Không để một context vừa viết renderer vừa sửa prompt vừa đụng RLS. Lý do: mỗi domain có bộ ràng buộc riêng dễ quên khi context bị pha loãng; gói nhỏ thì skill + docs cần đọc cũng nhỏ theo.
- **Đầu vào/đầu ra gói phải chạy được độc lập.** Gói sau phụ thuộc gói trước thì giao tuần tự và nêu rõ interface (kiểu, tên hàm, file) trong mô tả gói sau.
- **Chỉ đọc đúng mục docs cần.** Skill domain đã trỏ từng mục; tránh đọc cả docs/ khi chỉ cần một đoạn — tiết kiệm context cho việc thật.
- **Khảo sát rộng thì dùng Explore agent** (fan-out đọc nhiều file, trả kết luận), đừng tự đọc lần lượt từng file vào context chính.

## Giao việc cho subagent

- Việc gọn, 1 domain, ≤ ~3 file → làm trực tiếp ở context chính sau khi nạp skill domain.
- Việc to, nhiều gói, hoặc cần quét nhiều file → dùng Agent tool, mỗi gói một subagent. Prompt subagent **bắt buộc tự chứa đầy đủ** — subagent không thấy hội thoại này:

```
Bạn là agent phụ trách <domain> của dự án AI Signboard Studio tại D:\image.
1. Đọc D:\image\AGENTS.md, rồi nạp skill .agents/skills/signboard-<domain>/SKILL.md và làm theo nó.
2. Nhiệm vụ: <mô tả gói — đầu vào, file đụng đến, định nghĩa xong cụ thể>
3. Ràng buộc thêm của gói này: <liệt kê nếu có>
4. Cấm mock dữ liệu test; chỉ báo "pass" khi đã chạy lệnh thật và dán output thật.
Trả về: file đã đổi (path + tóm tắt), output test/build thật, các điểm còn mở.
```

- Chỉ khởi tạo **dynamic workflow** (CreateWorkflow) khi user nói rõ "dùng workflow"; ngoài ra Agent tool là mặc định.
- Nhận kết quả subagent xong: đối chiếu định nghĩa xong của gói, không nhận lời khai "xong" khi chưa có output lệnh thật.

## Ràng buộc cứng — kiểm tra trên MỌI gói trước khi báo xong

1. **AI KHÔNG vẽ — AI KHAI BÁO.** Không đưa logic vẽ/tọa độ/chia trang vào `lib/ai/`; không đưa gọi AI vào `engine/`.
2. **Patch theo `id` element**, không bao giờ theo array index; `op:'add'` luôn dùng id client cấp trước.
3. **Element types cố định** 6 loại; field 预留 (`dataBinding`, `embedding`, `schemaVersion`) không đổi tên, không xóa, giữ null ở MVP.
4. **STATIC_PREFIX prompt tĩnh tuyệt đối** — sửa prompt phải chỉnh `docs/SYSTEM_PROMPTS.md` trước rồi mirror sang code.
5. **Renderer kép đồng bộ** — đổi `svg(el)` phải đổi `pdf(el)` + snapshot test.
6. **Kỷ luật quota 0đ** — không thêm lượt gọi AI mới nếu chưa cân nhắc cache/rate-limit; không thêm dịch vụ trả phí.
7. **Bảo mật** — SQL chỉ parameter binding; credentials chỉ từ env; service role chỉ trong API route; BYOK không lưu không log.

## Kiểm chứng (từ AGENTS.md, không lặp lại ngoại lệ)

- Test chạm dữ liệu phải chạy luồng thật **client → /api/* → Supabase dev** — không stub, không fake response, không hardcode dữ liệu giả. Ngoại lệ duy nhất: unit test hàm thuần trong `engine/`.
- Không tuyên bố "test/build pass" khi chưa chạy lệnh thật và dẫn output thật.
- Cần mock thêm tầng nào khác → hỏi chủ sản phẩm trước.

## Dừng và hỏi chủ sản phẩm khi

- Thay đổi làm tăng lượt gọi AI hoặc thêm dịch vụ trả phí (vi phạm 0đ).
- Đổi schema Document (cần tăng `schemaVersion` + hàm migrate) hoặc đụng STATIC_PREFIX.
- Spec chưa định nghĩa điểm nào đó trong docs.
- Có overlap/xung đột với code mới kéo về từ origin.

Thảo luận theo đúng format dự án: mỗi lượt 3–4 câu hỏi, kèm 2–3 phương án có ưu/nhược, user trả lời kiểu "1A – 2C".

## Tài liệu thêm

- `references/task-splitting.md` — playbook tách việc theo milestone M1–M4, template prompt subagent, thứ tự gói đề xuất. Đọc khi cần lập kế hoạch cả milestone hoặc chạy nhiều gói song song.
