/**
 * patch-apply — áp Patch[] (nội bộ) theo id + z-order (gói M1.5 Quick Tap).
 *
 * Nguồn:
 * - docs/ARCHITECTURE.md §4 — Patch protocol theo `id` element, KHÔNG BAO GIỜ theo
 *   array index (AI đếm nhầm index; id client cấp → sai số 0 — AGENTS.md nguyên tắc 2).
 * - 02-plan 20261102-m15-quick-tap Bước 3: hiện thực §4 cho PATCH NỘI BỘ (`Patch` của
 *   doc.types.ts — `value: unknown`); Patch WIRE (valueStr/valueNum/valueBool của
 *   doc.zod.ts) là việc chuyển đổi ở M2, ngoài gói này.
 * - skill signboard-engine: layer-3 ngữ cảnh doc sai → BỎ op, KHÔNG retry (Quick Tap
 *   không phải đường AI — cũng chẳng có gì để retry); áp immutable copy-on-write.
 *
 * Engine thuần: chỉ import './doc.types' + './doc.zod' — không React, không network.
 */
import type { A4Doc, El, Patch } from './doc.types'
import { A4DocSchema, ElSchema } from './doc.zod'

/** docs/ARCHITECTURE.md §4 bước 4 — Diff cho UI highlight (M2; chỉ sinh cho op update). */
export interface Diff {
  id: string
  field: string
  oldValue: unknown
  newValue: unknown
}

export interface ApplyResult {
  doc: A4Doc
  diffs: Diff[]
  applied: Patch[]
  skipped: { patch: Patch; reason: string }[]
}

/** Field BaseEl được patch — mirror tập path của Patch WIRE (doc.zod.ts:92). */
const BASE_PATHS = new Set(['x', 'y', 'w', 'h', 'z', 'rotation'])

/** props.* hợp lệ theo loại element (mirror path regex doc.zod.ts:92 + props §3). */
const PROPS_BY_TYPE: Record<El['type'], ReadonlySet<string>> = {
  text: new Set(['text', 'font', 'weight', 'align', 'fitMode', 'maxLines', 'fill']),
  rect: new Set(['fill', 'radius', 'stroke', 'strokeWidth']),
  line: new Set(['stroke', 'strokeWidth']),
  image: new Set(['src']),
  path: new Set(['d', 'fill', 'stroke']),
  repeat: new Set([]), // repeat không có field patch được trong tập path WIRE
}

/** Path nhận value number — mọi path hợp lệ còn lại nhận string (enum do Zod chốt). */
const NUMERIC_PATHS = new Set([
  'x',
  'y',
  'w',
  'h',
  'z',
  'rotation',
  'props.weight',
  'props.maxLines',
  'props.strokeWidth',
  'props.radius',
])

/** Layer 2a: path có hợp lệ cho LOẠI element không (props.text trên rect → null reason). */
function pathIssue(el: El, path: string): string | null {
  if (BASE_PATHS.has(path)) return null
  const key = path.startsWith('props.') ? path.slice('props.'.length) : null
  if (key === null || !PROPS_BY_TYPE[el.type].has(key)) {
    return `path '${path}' không hợp lệ cho type '${el.type}'`
  }
  return null
}

/** Layer 2b: value đúng kiểu thô (x phải number, props.text phải string — enum/literal Zod bắt sau). */
function valueIssue(path: string, value: unknown): string | null {
  const expected = NUMERIC_PATHS.has(path) ? 'number' : 'string'
  if (typeof value !== expected) {
    return `value của '${path}' phải là ${expected === 'number' ? 'số' : 'chuỗi'}`
  }
  return null
}

function getPath(el: El, path: string): unknown {
  if (path.startsWith('props.')) {
    const props = (el as { props?: Record<string, unknown> }).props
    return props?.[path.slice('props.'.length)]
  }
  return (el as unknown as Record<string, unknown>)[path]
}

/** Copy-on-write: clone element + clone đúng nhánh bị đổi (props), phần còn lại dùng chung reference. */
function setPath(el: El, path: string, value: unknown): El {
  if (path.startsWith('props.')) {
    return {
      ...el,
      props: { ...(el as { props?: Record<string, unknown> }).props, [path.slice('props.'.length)]: value },
    } as El
  }
  return { ...el, [path]: value } as El
}

/** reason Zod ngắn gọn (issue đầu + path) — tiếng Việt phần định dạng do caller/doc mô tả. */
function zodReason(err: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const first = err.issues[0]
  if (!first) return 'không hợp lệ theo schema element'
  return first.path.length > 0
    ? `${first.path.map(String).join('.')}: ${first.message}`
    : first.message
}

/**
 * Áp dãy Patch theo thứ tự mảng, per op theo ARCHITECTURE §4:
 * 1. Layer-3 ngữ cảnh doc (update/remove → id phải có; add → id chưa có; none → no-op
 *    ghi reason) — sai → push skipped, KHÔNG retry.
 * 2. Path hợp lệ theo loại element + value đúng kiểu — sai → skipped.
 * 3. Áp immutable copy-on-write (chỉ clone element bị đổi + mảng elements).
 * 4. Validate element mới bằng ElSchema.safeParse — fail → skip op kèm reason Zod.
 *    Cuối cùng A4DocSchema.parse cả doc kết quả (bảo chứng đầu ra luôn hợp schema).
 * 5. diffs chỉ ghi cho op `update` (field = path); remove/add ghi vào `applied`
 *    (Diff cho HighlightOverlay là M2 — không bịa format trước).
 */
export function applyPatches(doc: A4Doc, patches: Patch[]): ApplyResult {
  const applied: Patch[] = []
  const skipped: { patch: Patch; reason: string }[] = []
  const diffs: Diff[] = []
  let elements: El[] = doc.elements // mọi phép đổi gán mảng MỚI — không đột biến mảng gốc
  const skip = (patch: Patch, reason: string): void => {
    skipped.push({ patch, reason })
  }

  for (const patch of patches) {
    switch (patch.op) {
      case 'none':
        skip(patch, patch.reason)
        break

      case 'update': {
        const idx = elements.findIndex((el) => el.id === patch.id)
        if (idx === -1) {
          skip(patch, `update: id '${patch.id}' không tồn tại trong doc`)
          break
        }
        const target = elements[idx]
        const pIssue = pathIssue(target, patch.path)
        if (pIssue !== null) {
          skip(patch, pIssue)
          break
        }
        const vIssue = valueIssue(patch.path, patch.value)
        if (vIssue !== null) {
          skip(patch, vIssue)
          break
        }
        const next = setPath(target, patch.path, patch.value)
        const checked = ElSchema.safeParse(next)
        if (!checked.success) {
          skip(patch, zodReason(checked.error))
          break
        }
        diffs.push({ id: patch.id, field: patch.path, oldValue: getPath(target, patch.path), newValue: patch.value })
        elements = [...elements.slice(0, idx), next, ...elements.slice(idx + 1)]
        applied.push(patch)
        break
      }

      case 'remove': {
        const idx = elements.findIndex((el) => el.id === patch.id)
        if (idx === -1) {
          skip(patch, `remove: id '${patch.id}' không tồn tại trong doc`)
          break
        }
        elements = [...elements.slice(0, idx), ...elements.slice(idx + 1)]
        applied.push(patch)
        break
      }

      case 'add': {
        if (elements.some((el) => el.id === patch.id)) {
          skip(patch, `add: id '${patch.id}' đã tồn tại trong doc`)
          break
        }
        if (elements.some((el) => el.id === patch.element.id)) {
          skip(patch, `add: id element '${patch.element.id}' đã tồn tại trong doc`)
          break
        }
        if (patch.after !== undefined && !elements.some((el) => el.id === patch.after)) {
          skip(patch, `add: after id '${patch.after}' không tồn tại trong doc`)
          break
        }
        const checked = ElSchema.safeParse(patch.element)
        if (!checked.success) {
          skip(patch, zodReason(checked.error))
          break
        }
        if (patch.after === undefined) {
          elements = [...elements, patch.element]
        } else {
          const at = elements.findIndex((el) => el.id === patch.after)
          elements = [...elements.slice(0, at + 1), patch.element, ...elements.slice(at + 1)]
        }
        applied.push(patch)
        break
      }
    }
  }

  // Bảo chứng đầu ra luôn hợp schema (validate sau mutate)
  const result = A4DocSchema.parse({ ...doc, elements })
  return { doc: result, diffs, applied, skipped }
}

/**
 * Sinh Patch[] đổi tầng (Quick Tap "Tầng lên / Tầng xuống" — 0 lượt AI).
 * Paint order = sort (z tăng dần, index mảng tăng dần) — MIRROR renderer
 * (svg-render.tsx sort z tăng STABLE) và hit-test (z giảm, index giảm).
 * Lấy phần tử kề trên/dưới trong paint order rồi HOÁN ĐỔI giá trị z (PL-3 —
 * z±1 thuần chỉ tạo z trùng rồi stable-sort giữ nguyên thứ tự vẽ → không đổi tầng).
 * Trả `[]` = không đổi được (đã trên cùng/dưới cùng, hoặc z bị đẩy < 0) → UI disables nút.
 */
export function zShiftPatches(doc: A4Doc, id: string, dir: 'up' | 'down'): Patch[] {
  const order = doc.elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => a.el.z - b.el.z || a.i - b.i)
  const pos = order.findIndex((o) => o.el.id === id)
  if (pos === -1) return []
  const neighbor = dir === 'up' ? order[pos + 1] : order[pos - 1]
  if (neighbor === undefined) return [] // đã là trên cùng (up) / dưới cùng (down)
  const me = order[pos].el

  if (me.z === neighbor.el.z) {
    // Cùng z: hoán đổi là no-op → đặt z lệch 1 để vượt kề (z ≥ 0 bắt buộc — doc.zod.ts:20)
    if (dir === 'up') return [{ op: 'update', id, path: 'z', value: neighbor.el.z + 1 }]
    const below = neighbor.el.z - 1
    return below >= 0 ? [{ op: 'update', id, path: 'z', value: below }] : []
  }

  return [
    { op: 'update', id, path: 'z', value: neighbor.el.z },
    { op: 'update', id: neighbor.el.id, path: 'z', value: me.z },
  ]
}
