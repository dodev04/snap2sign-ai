---
description: Pipeline 5 bước scout → planner → implementer → tester → reviewer, bàn giao qua file trong .handoff/<task-id>/ — dùng cho mọi việc code trong repo này
argument-hint: <yêu cầu cần làm>
---

# Pipeline 5 bước — yêu cầu: $ARGUMENTS

Nếu `$ARGUMENTS` trống → hỏi người dùng yêu cầu, không tự bịa.

Bạn (agent chính) là **orchestrator**. Mỗi bước chạy bằng đúng 1 subagent riêng (Agent tool, `subagent_type: general-purpose`), tuần tự, bàn giao qua file. Role spec nằm tại `.zcode/agents/<role>.md`. Frontmatter `tools`/`model` của role là **hợp đồng hành vi**: ZCode không khóa tool theo subagent, nên prompt subagent phải nhúng nguyên văn phần "Quy tắc bất di dịch" của role, và reviewer kiểm tra việc tuân thủ sau đó.

## Bước 0 — chuẩn bị
1. Đồng bộ git nếu chưa làm trong phiên: `git fetch origin`, so với `origin/main`; tụt sau thì `git pull --rebase` và đọc diff kéo về trước khi tiếp tục.
2. `task-id` = `<YYYYMMDD>-<slug>`: slug ngắn không dấu, chỉ thường + gạch ngang, từ yêu cầu (VD `20261031-scaffold-m1`). Nếu `.handoff/<task-id>/` đã tồn tại → thêm hậu tố `-2`, `-3`…
3. Ghi baseline `git status --short` (cuối phiên đối chiếu file đã thay đổi).
4. Cập nhật `docs/00-state/STATE.md` sang trạng thái `IN_PROGRESS` kèm `task-id`.

## Chuẩn chạy 1 bước
Với role R theo thứ tự scout → planner → implementer → tester → reviewer:
1. Đọc `.zcode/agents/R.md`.
2. Spawn 1 subagent `general-purpose`. Prompt phải **tự chứa đủ** (subagent bắt đầu fresh, không có ngữ cảnh phiên):
   - Nguyên văn role file `.zcode/agents/R.md`.
   - Task Card cấu trúc: Objective, Scope, Input Files (đường dẫn file handoff trước), Output Files (chỉ định file `0X-<role>.md`), Constraints, DoD.
   - Yêu cầu gốc + `task-id` + đường dẫn `.handoff/<task-id>/`.
   - (Nếu là lượt sửa): đường dẫn file handoff đưa vào (`04-test.md` / `05-review.md`).
3. **Cổng bàn giao:** sau khi subagent xong, kiểm tra file `.handoff/<task-id>/0X-<role>.md` của R: tồn tại + đủ 5 mục cố định của mẫu `.handoff/_templates/0X-*.md` (Tóm tắt, Nội dung chính, Quyết định đã chốt, Câu hỏi mở, Handoff) + dòng `Handoff →` đúng role kế tiếp. Thiếu → spawn lại R đúng 1 lần kèm cảnh báo cụ thể; vẫn thiếu → **DỪNG, báo người dùng**, không sang bước sau.

## Trình tự & vòng lặp
1. Chạy tuần tự: scout → planner → implementer → tester (mỗi bước qua cổng bàn giao).
2. Đọc "Kết luận tổng" trong `04-test.md`:
   - **PASS** → sang reviewer.
   - **FAIL vì lỗi code** → spawn implementer lại (input thêm `04-test.md`) → chạy tester lại. Tối đa **2 vòng** FAIL-sửa; vòng thứ 3 vẫn FAIL → **DỪNG, báo người dùng**.
   - **FAIL loại "chưa scaffold M1"** (`package.json` không tồn tại sau implementer — không phải lỗi code) → không đếm vòng sửa; **DỪNG**, báo người dùng: pipeline chỉ chạy trọn vẹn sau khi scaffold; đề nghị chạy `/scaffold M1` hoặc `/pipeline Scaffold Milestone 1 theo docs/ROADMAP.md`.
3. Đọc "Kết luận" trong `05-review.md`:
   - **APPROVE** → sang "Kết thúc".
   - **REQUEST_CHANGES** → spawn implementer (input `05-review.md`) → tester → reviewer lại. Tối đa **1 vòng**; lần thứ 2 vẫn REQUEST_CHANGES → **DỪNG, báo người dùng**.
4. Vượt giới hạn vòng bất kỳ nào: **DỪNG tuyệt đối** — không tự thử tiếp, không tự sửa hộ. Báo: đang kẹt ở bước nào, nội dung blocker/FAIL chính, các file handoff liên quan.

## Kết thúc
Báo cho người dùng, gồm:
1. Kết luận từ `05-review.md` (APPROVE / REQUEST_CHANGES + các mục còn lại theo mức độ).
2. File đã thay đổi: so `git status --short` với baseline Bước 0, tách 3 nhóm — code ứng dụng / file pipeline & docs / file handoff runtime (đã gitignore).
3. Việc tồn đọng: gộp "Câu hỏi mở" từ 01→05 + mục "nên sửa"/"gợi ý" của reviewer chưa xử lý.
4. Cập nhật `docs/00-state/STATE.md` và `docs/00-state/CHECKLIST.md` ghi nhận kết quả và commit hash nếu có.
5. **Không tự commit** — chỉ commit khi người dùng yêu cầu.

