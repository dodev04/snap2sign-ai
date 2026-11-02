/**
 * svg-render — A4Doc → chuỗi SVG preview (gói M1.3).
 *
 * Nguồn:
 * - docs/ARCHITECTURE.md §7 dòng 186: "`svg-render.tsx`: A4Doc → `<svg viewBox="0 0 210 297">`
 *   — tọa độ mm dùng thẳng làm đơn vị user, scale tự nhiên bằng CSS. 1 hệ tọa độ cho
 *   preview lẫn PDF → không lệch."
 * - docs/ARCHITECTURE.md §3 (dòng 66-111): schema renderer tiêu thụ (A4Doc + 6 El types).
 * - docs/ARCHITECTURE.md §9 dòng 217: "mỗi element type có 1 cặp hàm `svg(el)` / `pdf(el)`
 *   cạnh nhau trong code" — cặp `pdf*` sẽ viết ở M3.4 (TODO từng hàm dưới đây).
 * - docs/ROADMAP.md dòng 15: việc M1.3 "svg-render.tsx".
 *
 * File giữ đuôi `.tsx` đúng tên file trong spec nhưng nội dung KHÔNG chứa cú pháp JSX —
 * chỉ template literal sinh chuỗi SVG. Lý do (02-plan Quyết định 1): engine tinh khiết
 * deterministic (AGENTS.md nguyên tắc 1) — không kéo React/jsx-runtime vào, chạy 100%
 * trong vitest node hiện hữu, đối xứng với `pdf-render.ts` (M3.4) cũng sinh output tuần tự.
 *
 * Ràng buộc import (skill signboard-engine): chỉ './a4' | './doc.types' | './doc.zod' —
 * cấm React và mọi import từ lib/ai/, lib/db/, stores/.
 */
import { A4 } from './a4'
import type { A4Doc, El, ImageEl, LineEl, PathEl, RectEl, RepeatEl, TextEl } from './doc.types'
import { A4DocSchema } from './doc.zod'

// ═══ Helper nội bộ (không export) ═══

/** Escape XML cho text content/attribute: & < > " ' — chèn tag lạ vào SVG là không thể. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Làm tròn 2 chữ số lẻ, bỏ số 0 thừa — output deterministic ("15" chứ không "15.00"). */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/**
 * Map token font → CSS font stack fallback (SYSTEM_PROMPTS.md dòng 24: body = Be Vietnam Pro,
 * display = Montserrat ExtraBold, price = Anton). M1.3 chưa nhúng font OFL (việc của M2.5)
 * nên dùng stack fallback hệ thống — chấp nhận lệch metric tạm (02-plan Quyết định 5).
 * Hằng nội bộ, không chứa input ngoài → không cần esc khi xuất attribute.
 */
function fontStack(token: 'body' | 'display' | 'price'): string {
  switch (token) {
    case 'display':
      return "'Montserrat', 'Be Vietnam Pro', system-ui, sans-serif"
    case 'price':
      return "'Anton', 'Be Vietnam Pro', system-ui, sans-serif"
    default:
      return "'Be Vietnam Pro', system-ui, sans-serif"
  }
}

/**
 * Ước lượng bề rộng ký tự trung bình font sans so với fontSize (tĩnh — 0.6).
 * Đo thật bằng measureText là việc của autofit.ts (M2.4).
 */
const CHAR_W = 0.6

/**
 * PLACEHOLDER fontSize (M2.4 thay bằng autofit.ts binary search thật — 02-plan Quyết định 2):
 * - shrink-to-fit (1 dòng): f = min(h×0.8, (w×0.92) / (0.6 × max(1, len)))
 * - wrap (≤ maxLines):      f = min((h/maxLines)×0.8, (w×0.92) / (0.6 × ceil(len/maxLines)))
 * Làm tròn 0.1mm, clamp [2, h×0.8]. Không dùng textLength/dominant-baseline (SVG tự nén
 * khiến PDF M3.4 không lặp lại được phép tính — phá tinh thần renderer kép, Nguyên tắc 6).
 */
function placeholderFontSize(
  text: string,
  w: number,
  h: number,
  fitMode: 'shrink-to-fit' | 'wrap',
  maxLines: number,
): number {
  const len = Math.max(1, [...text].length) // đếm code point — đúng ký tự tiếng Việt tổ hợp
  let f: number
  if (fitMode === 'wrap') {
    const lines = Math.max(1, Math.ceil(len / Math.max(1, maxLines)))
    f = Math.min((h / Math.max(1, maxLines)) * 0.8, (w * 0.92) / (CHAR_W * lines))
  } else {
    f = Math.min(h * 0.8, (w * 0.92) / (CHAR_W * len))
  }
  f = Math.round(f * 10) / 10 // nguyên 0.1mm
  return Math.min(Math.max(f, 2), h * 0.8)
}

/**
 * Greedy word-wrap theo khoảng trắng (placeholder — M2.4 đo thật bằng measureText).
 * Giữ nguyên từ có dấu (không ngắt giữa từ); từ đơn dài hơn khung vẫn nằm nguyên dòng.
 * KHÔNG giấu chữ: khi đã đạt maxLines dòng, từ còn lại nối vào dòng cuối (dù dài hơn
 * khung) — "không bao giờ tràn" là việc của autofit M2.4, placeholder chỉ hiển thị đủ.
 */
function wrapLines(text: string, fontSize: number, w: number, maxLines: number): string[] {
  const maxChars = Math.max(1, Math.floor((w * 0.92) / (CHAR_W * fontSize)))
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const candidate = cur === '' ? word : cur + ' ' + word
    if (candidate.length <= maxChars || lines.length + 1 >= maxLines) {
      cur = candidate // dòng cuối cho phép dài — không giấu chữ
    } else {
      lines.push(cur)
      cur = word
    }
  }
  if (cur !== '') lines.push(cur)
  return lines.length > 0 ? lines : ['']
}

/**
 * transform quay quanh TÂM bbox (x+w/2, y+h/2) khi `rotation` xác định ≠ 0 —
 * cùng tâm quay với hit-testing M1.4 (transform ngược điểm quanh cùng tâm).
 */
function elTransform(
  el: { x: number; y: number; w: number; h: number; rotation?: number },
  ox = 0,
  oy = 0,
): string {
  if (el.rotation === undefined || el.rotation === 0) return ''
  const cx = el.x + ox + el.w / 2
  const cy = el.y + oy + el.h / 2
  return ` transform="rotate(${fmt(el.rotation)}, ${fmt(cx)}, ${fmt(cy)})"`
}

/** Dispatch per-type → cặp hàm svg* cạnh nhau; dùng cho doc gốc lẫn expand ảo repeat. */
function renderEl(el: El, ox = 0, oy = 0): string {
  switch (el.type) {
    case 'text':
      return svgText(el, ox, oy)
    case 'rect':
      return svgRect(el, ox, oy)
    case 'line':
      return svgLine(el, ox, oy)
    case 'image':
      return svgImage(el, ox, oy)
    case 'path':
      return svgPath(el, ox, oy)
    case 'repeat':
      return svgRepeat(el, ox, oy)
  }
}

// ═══ 6 hàm per-element — mỗi loại 1 cặp svg/pdf cạnh nhau (M3.4 viết cặp pdf) ═══

// TODO(M3.4): pdfText(el) — cặp đồng bộ theo AGENTS.md Nguyên tắc 6
/**
 * Text: anchor-x theo `align ?? 'left'` (left→x | center→x+w/2 | right→x+w); baseline
 * tính tay `y + h/2 + fontSize*0.35` (KHÔNG dominant-baseline) để pdfText lặp lại đúng
 * cùng phép tính; fontSize placeholder heuristic (M2.4 thay bằng autofit thật).
 * wrap: mỗi dòng 1 `<tspan x dy>` — dy = 1.2×fontSize (lineHeight) tính theo mm.
 */
export function svgText(el: TextEl, ox = 0, oy = 0): string {
  const p = el.props
  const fontSize = placeholderFontSize(p.text, el.w, el.h, p.fitMode, p.maxLines)
  const align = p.align ?? 'left'
  const anchorX =
    align === 'center' ? el.x + ox + el.w / 2 : align === 'right' ? el.x + ox + el.w : el.x + ox
  const textAnchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  const baseline = el.y + oy + el.h / 2 + fontSize * 0.35
  const lineHeight = fontSize * 1.2
  const open =
    `<text x="${fmt(anchorX)}" y="${fmt(baseline)}"` +
    ` font-family="${fontStack(p.font)}"` +
    ` font-size="${fmt(fontSize)}" font-weight="${p.weight ?? 400}"` +
    ` fill="${p.fill}" text-anchor="${textAnchor}"${elTransform(el, ox, oy)}>`
  if (p.fitMode === 'wrap') {
    const lines = wrapLines(p.text, fontSize, el.w, p.maxLines)
    const spans = lines
      .map((line, i) =>
        i === 0
          ? `<tspan x="${fmt(anchorX)}">${esc(line)}</tspan>`
          : `<tspan x="${fmt(anchorX)}" dy="${fmt(lineHeight)}">${esc(line)}</tspan>`)
      .join('')
    return `${open}${spans}</text>`
  }
  return `${open}${esc(p.text)}</text>`
}

// TODO(M3.4): pdfRect(el) — cặp đồng bộ theo AGENTS.md Nguyên tắc 6
/** Rect: có `stroke` mà thiếu `strokeWidth` → mặc định 0.5mm (02-plan Quyết định 7). */
export function svgRect(el: RectEl, ox = 0, oy = 0): string {
  const p = el.props
  const strokeWidth =
    p.stroke !== undefined && p.strokeWidth === undefined ? 0.5 : p.strokeWidth
  return (
    `<rect x="${fmt(el.x + ox)}" y="${fmt(el.y + oy)}" width="${fmt(el.w)}" height="${fmt(el.h)}"` +
    (p.radius !== undefined ? ` rx="${fmt(p.radius)}"` : '') +
    ` fill="${p.fill}"` +
    (p.stroke !== undefined ? ` stroke="${p.stroke}"` : '') +
    (strokeWidth !== undefined ? ` stroke-width="${fmt(strokeWidth)}"` : '') +
    elTransform(el, ox, oy) +
    '/>'
  )
}

// TODO(M3.4): pdfLine(el) — cặp đồng bộ theo AGENTS.md Nguyên tắc 6
/**
 * Line: w ≥ h → ngang (y1 = y2 = y + h/2, chạy x → x+w); ngược lại dọc (x1 = x2 = x + w/2).
 * Diễn dịch §3 dòng 38 "đường ngang/dọc từ (x,y) dài w|h": đường chạy theo trục dài,
 * qua tâm bbox — tuyến tính deterministic, dễ mirror sang pdf-lib (02-plan Quyết định 6).
 */
export function svgLine(el: LineEl, ox = 0, oy = 0): string {
  const x = el.x + ox
  const y = el.y + oy
  const horizontal = el.w >= el.h
  const x1 = horizontal ? x : x + el.w / 2
  const y1 = horizontal ? y + el.h / 2 : y
  const x2 = horizontal ? x + el.w : x + el.w / 2
  const y2 = horizontal ? y + el.h / 2 : y + el.h
  return (
    `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"` +
    ` stroke="${el.props.stroke}" stroke-width="${fmt(el.props.strokeWidth)}"` +
    elTransform(el, ox, oy) +
    '/>'
  )
}

// TODO(M3.4): pdfImage(el) — cặp đồng bộ theo AGENTS.md Nguyên tắc 6
/**
 * Image: rect xám #EEEEEE phía DƯỚI `<image>` làm fallback deterministic khi nguồn
 * hỏng/chưa có Storage (M4.1) — #EEEEEE ngoài palette in nhưng chỉ là placeholder preview,
 * KHÔNG phải element doc, không in ra. fit: cover→"xMidYMid slice", contain→"xMidYMid meet".
 */
export function svgImage(el: ImageEl, ox = 0, oy = 0): string {
  const x = el.x + ox
  const y = el.y + oy
  const fit = el.props.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'
  return (
    `<g${elTransform(el, ox, oy)}>` +
    `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(el.w)}" height="${fmt(el.h)}" fill="#EEEEEE"/>` +
    `<image href="${esc(el.props.src)}" x="${fmt(x)}" y="${fmt(y)}"` +
    ` width="${fmt(el.w)}" height="${fmt(el.h)}" preserveAspectRatio="${fit}"/>` +
    '</g>'
  )
}

// TODO(M3.4): pdfPath(el) — cặp đồng bộ theo AGENTS.md Nguyên tắc 6
// MIRROR(M3.4) — quy tắc fill mặc định của Path (chốt sau blocker 05-review vòng 1):
// pdfPath PHẢI lặp lại TƯƠNG ĐƯƠNG cả 3 nhánh fill bên dưới (fill khai báo → giữ nguyên;
// stroke-only → KHÔNG tô; cả-hai-thiếu → mực #212121). pdf-lib không có default fill
// kiểu browser (để trống là không tô, không tự đen), nên nếu pdfPath không chốt tường
// minh cùng bảng quy tắc này thì cùng 1 doc sẽ ra 2 hình khác nhau → lệch cặp Nguyên tắc 6.
/**
 * Path: `d` nguyên trạng (path-data hợp lệ M L C Q Z + số không chứa ký tự XML đặc biệt;
 * esc() chỉ phòng hộ, không đổi gì với d hợp lệ). Fill mặc định 3 nhánh:
 * - có `fill` → nguyên trạng;
 * - có `stroke` mà thiếu `fill` → `fill="none"` — bắt buộc tường minh, vì bỏ trống thì
 *   browser áp default fill #000000 (ngoài palette in an toàn, SYSTEM_PROMPTS.md dòng 25)
 *   biến họa tiết chỉ-net thành khối đen đặc (blocker 05-review vòng 1);
 * - cả fill lẫn stroke đều thiếu → fill mực palette in an toàn #212121 (Quyết định 7).
 */
export function svgPath(el: PathEl, ox = 0, oy = 0): string {
  const p = el.props
  const fillAttr =
    p.fill !== undefined
      ? ` fill="${p.fill}"`
      : p.stroke !== undefined
        ? ' fill="none"'
        : ' fill="#212121"'
  return (
    `<path d="${esc(p.d)}"` +
    fillAttr +
    (p.stroke !== undefined ? ` stroke="${p.stroke}"` : '') +
    elTransform(el, ox, oy) +
    '/>'
  )
}

// TODO(M3.4): pdfRepeat(el) — cặp đồng bộ theo AGENTS.md Nguyên tắc 6
/**
 * Repeat — expand ẢO đúng công thức §8 với i = 0 (col = 0, row = 0 → offset = (el.x, el.y)):
 * render đệ quy từng itemTemplate.elements với x/y cục bộ cộng offset. KHÔNG ghi đè doc
 * gốc — chỉ đọc (ARCHITECTURE dòng 117 "expand ảo, không ghi đè"); KHÔNG vẽ khung trang
 * trí ngoài doc. Literal `{{name}}/{{price}}/{{unit}}/{{discount}}` giữ nguyên — thay bằng
 * giá trị items[] là việc của repeat-paginate.ts (M3); preview M1.3 chưa có items.
 */
export function svgRepeat(el: RepeatEl, ox = 0, oy = 0): string {
  const inner = el.itemTemplate.elements
    .map((sub) => renderEl(sub, ox + el.x, oy + el.y))
    .join('')
  return `<g${elTransform(el, ox, oy)}>${inner}</g>`
}

// ═══ Export chính ═══

/**
 * Render toàn bộ A4Doc → chuỗi SVG string.
 * (a) `A4DocSchema.parse` đầu vào — doc sai schema → throw ZodError sớm, deterministic
 *     (02-plan Quyết định 8; engine nội bộ nên không vi phạm ranh giới no-network).
 * (b) Sort BẢN SAO elements theo z tăng dần (z lớn = vẽ sau = nằm trên, doc.types.ts:16)
 *     — KHÔNG đột biến mảng gốc.
 * (c) Bọc `<svg viewBox="0 0 210 297">` — tái dùng hằng A4 từ './a4', không hardcode số.
 */
export function renderA4DocSvg(doc: A4Doc): string {
  const parsed = A4DocSchema.parse(doc)
  const sorted = [...parsed.elements].sort((a, b) => a.z - b.z)
  const body = sorted.map((el) => renderEl(el)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A4.w} ${A4.h}">${body}</svg>`
}
