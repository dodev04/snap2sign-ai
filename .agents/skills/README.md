# Bộ skill dự án — AI Signboard Studio

5 skill hướng dẫn implement theo blueprint trong `docs/`. Thiết kế theo 2 tầng để **tối ưu context**: mỗi phiên làm việc chỉ nạp đúng skill domain nó cần, orchestrator lo việc định tuyến và tách gói.

| Skill | Vai trò | Nạp khi |
|---|---|---|
| `signboard-orchestrator` | Điều phối: phân loại domain, tách gói việc vừa 1 context, giao subagent, kiểm tra ràng buộc cứng | Nhận việc mới của dự án, việc đụng nhiều tầng, cần chia việc/lập kế hoạch milestone |
| `signboard-engine` | Lõi deterministic `src/engine/`: A4Doc schema, patch theo id, auto-fit, renderer kép SVG/PDF, repeat-paginate | Code/sửa engine, đổi schema Document, renderer, test unit |
| `signboard-ai-layer` | Tầng AI `src/lib/ai/`: STATIC_PREFIX + 5 intent, responseSchema → Zod → retry ≤1, kỷ luật quota | Sửa prompt, intent, Gemini client, retry, rate-limit |
| `signboard-backend` | API Edge + Supabase: 4 bảng + RLS, service role, BYOK, upload, cron keepalive, bảo mật SQL | Code `/api/*`, `lib/db/`, schema.sql, auth/RLS, vận hành |
| `signboard-frontend` | Editor UI: Zustand store, SVG preview + hit-testing, Quick Tap, CommandBar, UX tiếng Việt | Code routes/components/stores, UX editor, mobile/PC |

## Nguyên tắc thiết kế bộ skill

- **`docs/` vẫn là nguồn chân lý duy nhất.** Skill không sao chép spec — chỉ chứa workflow, ràng buộc tóm tắt và con trỏ tới đúng mục docs cần đọc. Docs đổi → skill không bị lỗi knowledge.
- **1 gói = 1 domain = 1 skill.** Tránh một context vừa renderer vừa prompt vừa RLS — mỗi domain có bộ ràng buộc dễ quên khi context pha loãng.
- **Orchestrator biết bức tranh lớn, domain skill biết chi tiết.** Subagent nhận prompt tự chứa kèm đường dẫn skill — không cần lịch sử hội thoại.

## Cấu trúc

```
.agents/skills/
  README.md                        # file này
  signboard-orchestrator/
    SKILL.md                       # định tuyến + tách gói + ràng buộc cứng
    references/task-splitting.md   # playbook tách việc M1-M4 + template prompt subagent
  signboard-engine/SKILL.md
  signboard-ai-layer/SKILL.md
  signboard-backend/SKILL.md
  signboard-frontend/SKILL.md
```
