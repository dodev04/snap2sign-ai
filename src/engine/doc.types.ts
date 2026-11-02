/**
 * Document JSON Schema v1 — TS types nguyên văn docs/ARCHITECTURE.md §3 (dòng 70-111)
 * + Patch protocol theo id §4 (dòng 124-129).
 * Đơn vị: mm tuyệt đối, khổ A4 210×297, gốc tọa độ (0,0) góc trên-trái, x → phải, y → xuống.
 * File thuần types — 0 import, không phụ thuộc gì (engine deterministic thuần).
 */

/** docs/ARCHITECTURE.md §3 dòng 70 */
export type ElType = 'text' | 'rect' | 'line' | 'image' | 'path' | 'repeat'

/** docs/ARCHITECTURE.md §3 dòng 72-78 */
export interface BaseEl {
  id: string            // client cấp: 'e1', 'e2'... EXTRACT id do AI đếm, client re-id khi ingest
  x: number; y: number; w: number; h: number   // mm
  rotation?: number     // độ
  z: number             // thứ tự vẽ, lớn = trên
  dataBinding?: null    // 预留 cho binding tương lai — giữ null ở MVP
}

/** docs/ARCHITECTURE.md §3 dòng 80-91 */
export interface TextEl extends BaseEl {
  type: 'text'
  props: {
    text: string
    font: 'body' | 'display' | 'price'   // Be Vietnam Pro | Montserrat ExtraBold | Anton
    weight?: 400 | 700 | 900
    fill: string                         // hex #RRGGBB
    align?: 'left' | 'center' | 'right'
    fitMode: 'shrink-to-fit' | 'wrap'
    maxLines: number                     // wrap: ngắt tối đa N dòng; shrink: luôn 1
  }
}
/** docs/ARCHITECTURE.md §3 dòng 92-93 */
export interface RectEl extends BaseEl { type: 'rect'; props: {
  fill: string; radius?: number; stroke?: string; strokeWidth?: number } }
/** docs/ARCHITECTURE.md §3 dòng 94-95 */
export interface LineEl extends BaseEl { type: 'line'; props: {
  stroke: string; strokeWidth: number } }        // đường ngang/dọc từ (x,y) dài w|h
/** docs/ARCHITECTURE.md §3 dòng 96-97 */
export interface ImageEl extends BaseEl { type: 'image'; props: {
  src: string; fit: 'cover' | 'contain' } }      // src = path trong Supabase Storage
/** docs/ARCHITECTURE.md §3 dòng 98-99 */
export interface PathEl extends BaseEl { type: 'path'; props: {
  d: string; fill?: string; stroke?: string } }  // SVG path-data họa tiết đơn giản

/**
 * docs/ARCHITECTURE.md §3 dòng 100-105. Ngoại lệ kỹ thuật đã chốt (02-plan Quyết định 6):
 * §3 ghi `extends BaseEl` nhưng `dataBinding?: null` của BaseEl mâu thuẫn với
 * `dataBinding: { source: 'items' }` dưới TS strict → Omit field của Base rồi tự khai
 * lại đúng hình dạng §3. KHÔNG nới kiểu `dataBinding` của BaseEl (nguyên tắc 3 AGENTS.md).
 */
export interface RepeatEl extends Omit<BaseEl, 'dataBinding'> { type: 'repeat'
  dataBinding: { source: 'items' }
  itemTemplate: { h: number; elements: El[] }    // text chứa '{{name}}' '{{price}}' '{{unit}}' '{{discount}}'
  grid: { cols: number; gapX: number; gapY: number }
  overflow: 'paginate'
}

/** Union đủ 6 loại element — flat list trong A4Doc (không lồng nhau). */
export type El = TextEl | RectEl | LineEl | ImageEl | PathEl | RepeatEl

/** docs/ARCHITECTURE.md §3 dòng 107-111 */
export interface A4Doc {
  schemaVersion: 1
  page: { w: 210; h: 297; unit: 'mm' }
  elements: El[]                        // KHÔNG lồng nhau — flat list
}

/**
 * docs/ARCHITECTURE.md §4 dòng 124-129 — Patch theo `id` element, KHÔNG BAO GIỜ theo array index
 * (AI đếm nhầm index là lỗi phổ biến nhất; id client cấp → sai số 0).
 * Đây là Patch NỘI BỘ engine (sau khi decode): `value: unknown`, `element: El` lồng.
 * Patch WIRE (dạng AI trả: valueStr/valueNum/valueBool, element flattened) nằm ở `doc.zod.ts`
 * (02-plan Quyết định 5 — hai Patch song song chủ đích, consumer alias khi import cả hai).
 */
export type Patch =
  | { op: 'update'; id: string; path: string; value: unknown }  // path: 'props.fill' | 'x' | 'w'...
  | { op: 'add';    id: string; after?: string; element: El }   // id do CLIENT cấp trước, AI chỉ dùng lại
  | { op: 'remove'; id: string }
  | { op: 'none';   reason: string }                             // AI từ chối khéo + lý do tiếng Việt
