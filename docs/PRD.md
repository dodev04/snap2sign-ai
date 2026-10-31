# AI SIGNBOARD STUDIO — PRD (Product Requirements Document)

**Phiên bản:** 1.0 · **Ngày:** 2026-10-31 · **Trạng thái:** Đã chốt (tổng hợp 4 giai đoạn thảo luận)

---

## 1. Tầm nhìn sản phẩm

Web app (PC + Mobile Web) giúp chủ tiệm tạp hóa / siêu thị mini / cửa hàng chuyển **một tấm ảnh chụp biển bảng giá** thành **mẫu thiết kế vector chuẩn khổ A4 chuẩn in**, rồi sửa bằng **lệnh tự nhiên** thay vì kéo thả như Canva.

**Điểm khác biệt cốt lõi (AI-Native / Conversational Editor):** AI được nhúng trực tiếp vào quá trình chỉnh sửa. Người dùng gõ (hoặc nói ở bản sau) một câu tiếng Việt bình thường — AI tự sửa chữ, đổi màu, thêm bớt chi tiết, hoặc dàn 1 câu lệnh dài thành hàng chục trang PDF A4.

**Nguyên tắc vàng xuyên suốt:**

> **AI KHÔNG vẽ — AI KHAI BÁO. Engine deterministic lo phần vẽ.**
> Mọi thứ AI dễ sai (tọa độ chính xác, fontSize vừa chữ, chia trang) chạy 100% ở client — miễn phí, chính xác tuyệt đối, lặp lại được.

---

## 2. Personas

| Persona | Mô tả | Nhu cầu chính |
|---|---|---|
| **Chị Lan** — chủ tiệm tạp hóa | 45 tuổi, dùng điện thoại Android, không biết thiết kế là gì | Chụp ảnh biển cũ → AI dời trang → sửa giá → in lại. Số lần chạm càng ít càng tốt |
| **Anh Minh** — quản lý chuỗi mini mart | Dùng PC, mỗi tuần đổi 30-80 mặt hàng | 1 câu lệnh dài → hàng chục trang PDF đồng bộ, lưu kho mẫu tái sử dụng |
| **Thiết kế viên tự do** (power user) | Hiểu kỹ thuật, có Google account riêng | BYOK — dùng API key riêng, chỉnh sâu từng element |

---

## 3. Quyết định UX đã chốt (Giai đoạn 1)

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Bố cục Mobile | **Pill bar nổi** "Sửa bằng AI…" dưới đáy màn hình; tap mở **khay chip gợi ý + lịch sử gần nhất**, cao vừa khung, **không che vùng tờ A4**; bấm gửi lệnh xong **auto-collapse** về pill bar để nhìn kết quả ngay |
| 2 | Bố cục PC | **Sidebar phải cố định** (kiểu Copilot/ChatGPT canvas). Cùng 1 component với pill bar, chia bằng CSS responsive |
| 3 | Quick Tap | Tap chọn element → viền sáng + **menu nhanh**: Sửa chữ / Đổi màu / Xóa / Tầng trên-dưới / "AI sửa mục này". **Sửa chữ là local — 0 lượt gọi AI** |
| 4 | Tap × AI (hybrid) | Đã chọn element → **chip 🎯[element]** hiện trong ô input, lệnh sau đó chỉ áp cho element đó (intent `TARGETED_EDIT`). Chưa chọn gì → AI tự suy luận toàn bảng (intent `BOARD_EDIT`) |
| 5 | Kết quả AI | **Auto-apply** ngay lên Preview + nhấp nháy highlight vùng vừa đổi + nút Undo nhanh |
| 6 | Hoàn tác | **Undo stack ~20 bước** + **snapshot tự động mỗi lệnh AI** + nút "Lưu phiên bản này vào Kho mẫu" bất cứ lúc nào |
| 7 | Voice | Chat-only MVP; mic (Web Speech API) để milestone sau |

---

## 4. User flows chính

### 4.1. Flow dựng mẫu từ ảnh (lần đầu)
1. User chụp/upload ảnh biển bảng (camera hoặc file)
2. Client nén + chuẩn hóa ảnh (khử EXIF, resize) → tính SHA-256 → **tra `extraction_cache` trước**
   - Trùng: trả ngay Document JSON, **0 lượt AI**, nhảy thẳng bước 4
   - Không trùng: gọi 1 lượt Gemini Vision (intent EXTRACT) → Zod validate → lưu cache
3. Document JSON đổ vào editor → SVG preview khổ A4
4. User sửa bằng Quick Tap / lệnh AI → Auto-apply + Undo / Snapshot
5. Xuất PDF hoặc Lưu vào Kho mẫu

### 4.2. Flow chỉnh sửa bằng AI (hằng ngày)
- Có chọn element: chip 🎯 + gõ lệnh → `TARGETED_EDIT` → patch ngắn chỉ đụng element đó
- Không chọn: gõ lệnh tự do → `BOARD_EDIT` → AI tự tìm element liên quan
- Quick Tap sửa chữ/đổi màu/xóa: **hoàn toàn local, không tốn quota**

### 4.3. Flow tạo hàng loạt (batch)
1. User gõ 1 câu dài: *"Củ quả giảm 30%: cà rốt 15k, khoai tây 20k, su hũu 12k, hành lá 5k…"*
2. 1 lượt AI (intent `BATCH_EXTRACT`) tách `items[]` + confidence từng item
3. **Cổng confidence:**
   - ≤5 item và mọi confidence ≥ 0.85 → auto-apply luôn
   - ≥6 item hoặc có item yếu → chèn bảng **"Duyệt dữ liệu"** (sửa trực tiếp kiểu Excel-lite, ô yếu nền vàng)
4. Engine dàn N trang qua node `repeat` (grid + tràn trang) — **không thêm lượt AI nào**
5. Xuất **1 file PDF nhiều trang A4**

### 4.4. Flow Kho mẫu
- Bấm "Lưu vào Kho" → client sinh thumbnail (canvas → PNG) → 1 lượt AI `TAG_TEMPLATE` gán tags + tên + mô tả → lưu DB
- Tìm kiếm: chip filter (danh mục / màu / phong cách / số cột) + full-text tên & mô tả
- Field `embedding` đặt sẵn trong DB — bật semantic search khi kho ≥ 30 mẫu

---

## 5. Success metrics (MVP)

| Metric | Mục tiêu |
|---|---|
| Thời gian từ upload → lần chỉnh sửa đầu tiên | < 60 giây (gồm 1 lượt EXTRACT) |
| Tỷ lệ patch AI áp dụng thành công (sau Zod + retry) | ≥ 99% |
| Thời gian xuất PDF 20 trang A4 (client-side) | < 10 giây |
| Lượt gọi Gemini / 1 phiên chỉnh sửa thông thường | ≤ 3 (extract 1 + edits ≤ 2) |
| Chi phí hạ tầng vận hành | 0đ (Vercel Hobby + Supabase Free + Gemini Free Tier) |

---

## 6. Out of scope (MVP)

- Nhập lời nói (mic) — để milestone sau, hướng Web Speech API
- Semantic search kho mẫu (embedding chỉ预留 field)
- Đăng nhập mạng xã hội ngoài Google/Email, team/collaborate
- Xuất khổ in khác A4,出血/bleed mark cho nhà in offset
- Mobile native app (chỉ Web, có thể đóng gói PWA-lite)
