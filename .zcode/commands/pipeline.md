---
description: Pipeline 5 phase scout → planner → implementer → tester → reviewer, bàn giao qua file trong .handoff/<task-id>/ — dùng cho mọi việc code trong repo này
argument-hint: <yêu cầu cần làm>
---

# Pipeline 5 phase — yêu cầu: $ARGUMENTS

Nếu `$ARGUMENTS` trống → hỏi người dùng yêu cầu, không tự bịa.

Bạn (agent chính) là **orchestrator**: chạy từng phase tuần tự, mỗi phase đúng 1 subagent, bàn giao qua file. Subagent spawn bằng Agent tool với **`subagent_type` đúng tên role** (`scout` | `planner` | `implementer` | `tester` | `reviewer`) — runtime đăng ký từ `.zcode/agents/<role>.md` và nạp role file làm system prompt của subagent, nên **không nhúng lại role file vào prompt**. Prompt vẫn phải **tự chứa đủ** (subagent bắt đầu fresh, không có ngữ cảnh phiên).

## Quy ước chung
1. **Task Card** mỗi phase gồm: Objective, Scope, Input Files (file handoff phase trước), Output Files (file `0X-<role>.md`), Constraints, DoD — kèm yêu cầu gốc, `task-id`, đường dẫn `.handoff/<task-id>/`.
2. **Cổng bàn giao** (sau mỗi phase 1→5): file `.handoff/<task-id>/0X-<role>.md` tồn tại + đủ 5 mục cố định của mẫu `.handoff/_templates/0X-*.md` (Tóm tắt, Nội dung chính, Quyết định đã chốt, Câu hỏi mở, Handoff) + dòng `Handoff →` đúng role kế tiếp. Thiếu → spawn lại đúng role đó đúng 1 lần kèm cảnh báo cụ thể; vẫn thiếu → **DỪNG, báo người dùng**, không sang phase sau.
3. **Lượt sửa** (vòng FAIL / REQUEST_CHANGES): spawn lại đúng `subagent_type` của role, thêm đường dẫn file handoff đưa vào (`04-test.md` / `05-review.md`) vào Input Files.

## Phase 0 — chuẩn bị (orchestrator tự làm, không subagent)
1. Đồng bộ git nếu chưa làm trong phiên: `git fetch origin`, so với `origin/main`; tụt sau thì `git pull --rebase` và đọc diff kéo về trước khi tiếp tục.
2. `task-id` = `<YYYYMMDD>-<slug>`: slug ngắn không dấu, chỉ thường + gạch ngang, từ yêu cầu (VD `20261031-scaffold-m1`). Nếu `.handoff/<task-id>/` đã tồn tại → thêm hậu tố `-2`, `-3`…
3. Ghi baseline `git status --short` (cuối phiên đối chiếu file đã thay đổi).
4. Cập nhật `docs/00-state/STATE.md` sang trạng thái `IN_PROGRESS` kèm `task-id`.

## Phase 1→5 — mỗi phase đúng 1 subagent

| Phase | subagent_type | Input Files | Output (cổng bàn giao) |
|---|---|---|---|
| 1 | `scout` | yêu cầu gốc | `01-scout.md` |
| 2 | `planner` | `01-scout.md` | `02-plan.md` |
| 3 | `implementer` | `02-plan.md` | `03-impl.md` |
| 4 | `tester` | `03-impl.md` | `04-test.md` + `evidence/` |
| 5 | `reviewer` | `02-plan.md`, `04-test.md` (+ `evidence/`), git diff | `05-review.md` |

## Vòng lặp sau Phase 4 (tester)
Đọc "Kết luận tổng" trong `04-test.md`:
- **PASS** → sang Phase 5.
- **FAIL vì lỗi code** → spawn lại `implementer` (input thêm `04-test.md`) → chạy lại Phase 4. Tối đa **2 vòng** FAIL-sửa; vòng thứ 3 vẫn FAIL → **DỪNG, báo người dùng**.
- **FAIL loại "chưa scaffold M1"** (`package.json` không tồn tại sau implementer — không phải lỗi code) → không đếm vòng sửa; **DỪNG**, báo người dùng: pipeline chỉ chạy trọn vẹn sau khi scaffold; đề nghị chạy `/scaffold M1` hoặc `/pipeline Scaffold Milestone 1 theo docs/ROADMAP.md`.

## Vòng lặp sau Phase 5 (reviewer)
Đọc "Kết luận" trong `05-review.md`:
- **APPROVE** → sang "Kết thúc".
- **REQUEST_CHANGES** → spawn `implementer` (input `05-review.md`) → Phase 4 → Phase 5 lại. Tối đa **1 vòng**; lần thứ 2 vẫn REQUEST_CHANGES → **DỪNG, báo người dùng**.

Vượt giới hạn vòng bất kỳ nào: **DỪNG tuyệt đối** — không tự thử tiếp, không tự sửa hộ. Báo: đang kẹt ở phase nào, nội dung blocker/FAIL chính, các file handoff liên quan.

## Kết thúc
Báo cho người dùng, gồm:
1. Kết luận từ `05-review.md` (APPROVE / REQUEST_CHANGES + các mục còn lại theo mức độ).
2. File đã thay đổi: so `git status --short` với baseline Phase 0, tách 3 nhóm — code ứng dụng / file pipeline & docs / file handoff runtime (đã gitignore).
3. Việc tồn đọng: gộp "Câu hỏi mở" từ 01→05 + mục "nên sửa"/"gợi ý" của reviewer chưa xử lý.
4. Cập nhật `docs/00-state/STATE.md` và `docs/00-state/CHECKLIST.md` ghi nhận kết quả và commit hash nếu có.
5. **Không tự commit** — chỉ commit khi người dùng yêu cầu.
