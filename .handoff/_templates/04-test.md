# 04-test — <task-id> (lượt <n>)

## Tóm tắt
<!-- 1-3 câu: đã chạy lệnh gì, test kịch bản Playwright nào, kết quả tổng thể -->

## Nội dung chính

### 1. Lệnh CLI đã chạy
| Lệnh | Có chạy được | Exit code | Kết luận |
|---|---|---|---|
| `npm run lint` |  |  |  |
| `npm run build` |  |  |  |
| `npx vitest run` |  |  |  |

<!-- Chưa scaffold (không có package.json): ghi "KHÔNG CHẠY ĐƯỢC — dự án chưa scaffold M1", exit code N/A -->

### 2. Kịch bản Playwright Browser Walkthrough (QA-001)
<!-- Bắt buộc với mọi task chạm UI/UX/Editor: khởi chạy app và tương tác thật trên browser -->
| Bước | Thao tác người dùng | Viewport | Kết quả quan sát trực quan | File ảnh Screenshot bằng chứng |
|---|---|---|---|---|
| 1 | Mở trang Editor (`/`) | Desktop (1440x900) | Tờ A4 hiển thị đúng tỷ lệ, render 6 loại element | `.handoff/<task-id>/evidence/01-desktop-render.png` |
| 2 | Chuyển chế độ Mobile Web | Mobile (390x844) | Giao diện co giãn responsive, không vỡ layout | `.handoff/<task-id>/evidence/02-mobile-responsive.png` |
| 3 | Click chọn element (Hit-test) | Cả 2 | Menu Quick Tap nảy lên đúng vị trí | `.handoff/<task-id>/evidence/03-quicktap-active.png` |
| 4 | Thao tác sửa / đổi màu | Cả 2 | Canvas cập nhật tức thì, không giật lag | `.handoff/<task-id>/evidence/04-modified.png` |
| 5 | Bấm nút Undo | Cả 2 | Trạng thái hoàn tác chuẩn xác 100% | `.handoff/<task-id>/evidence/05-undo.png` |

### 3. Browser Console Log
```text
<!-- Dán trích xuất log console từ Playwright: chứng minh 0 Unhandled Exception, 0 React Hydration Warning -->
```

### 4. Log lỗi chính (nếu có FAIL)
<!-- trích ngắn output thật từ terminal hoặc browser console, ghi rõ lệnh tương ứng -->

### 5. Nguyên nhân giả định & Hướng sửa cho Implementer (nếu FAIL)
<!-- file nghi ngờ, dòng lỗi, hướng sửa cụ thể -->

### 6. Kết luận tổng: PASS | FAIL | INCOMPLETE
<!-- PASS chỉ khi: CLI tests xanh 100% VÀ Playwright Browser Screenshots đầy đủ theo QA-001. Thiếu ảnh browser => INCOMPLETE -->

## Quyết định đã chốt
<!-- Các quyết định kỹ thuật trong quá trình test -->

## Câu hỏi mở
<!-- Vấn đề nghi ngờ cần xin ý kiến reviewer hoặc chủ sản phẩm -->

Handoff → reviewer: .handoff/<task-id>/04-test.md
