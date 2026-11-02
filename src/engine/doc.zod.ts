/**
 * Zod schemas — mirror nguyên văn docs/SYSTEM_PROMPTS.md §6 (dòng 314-379).
 * Nguồn chân lý là docs: muốn đổi bound/field → chỉnh SYSTEM_PROMPTS.md trước rồi mirror lại
 * (AGENTS.md nguyên tắc 4 — không "cải tiến" code mirror tại chỗ).
 * Layer này chỉ VALIDATE, không transform (skill signboard-engine).
 * Import đúng 2 thứ: 'zod' và type El từ './doc.types' — không import lib/stores/app.
 */
import { z } from 'zod'
import type { El } from './doc.types'

// ═══ Phần mirror nguyên văn docs/SYSTEM_PROMPTS.md §6 (dòng 314-379) ═══

export const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
export const InPage = z.number().min(-5).max(302)      // cho phép sai số nhỏ, Zod chặt hơn ở bước apply

export const ElementBase = z.object({
  id: z.string().regex(/^E\d{1,4}$/),                   // sau re-id client
  x: InPage, y: InPage, w: z.number().positive().max(215), h: z.number().positive().max(302),
  rotation: z.number().min(-180).max(180).optional(),
  z: z.number().int().nonnegative(),
  dataBinding: z.null().optional(),
})

export const TextProps = z.object({
  text: z.string().min(1),
  font: z.enum(['body', 'display', 'price']),
  weight: z.union([z.literal(400), z.literal(700), z.literal(900)]).optional(),
  fill: HexColor,
  align: z.enum(['left', 'center', 'right']).optional(),
  fitMode: z.enum(['shrink-to-fit', 'wrap']),
  maxLines: z.number().int().min(1).max(6),
})

/**
 * Hiện thực comment "+ superRefine theo type" của nhánh add (§6 dòng 344-345):
 * element flattened = ElementBase + `type` enum 5 loại (AI KHÔNG sinh repeat — responseSchema
 * §1/§2 chỉ 5 loại; RepeatEl chỉ xuất hiện sau flow batch, ARCHITECTURE §3 dòng 117)
 * + bộ field flattened đúng element ExtractResult (§6 dòng 352-364: text/font/fill/stroke/
 * strokeWidth/radius/align/fitMode/maxLines/src/d — phải khai báo thì superRefine mới kiểm được,
 * vì Zod strip unknown key).
 * superRefine đòi field bắt buộc theo loại, bám props §3 (02-plan Quyết định 7);
 * không check element.id === patch.id (spec chưa định nghĩa).
 */
const AddElement = ElementBase.extend({
  type: z.enum(['text', 'rect', 'line', 'image', 'path']),
  text: z.string().optional(),
  font: z.enum(['body', 'display', 'price']).optional(),
  fill: HexColor.optional(), stroke: HexColor.optional(),
  strokeWidth: z.number().positive().max(10).optional(),
  radius: z.number().min(0).max(50).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  fitMode: z.enum(['shrink-to-fit', 'wrap']).optional(),
  maxLines: z.number().int().min(1).max(6).optional(),
  src: z.string().optional(), d: z.string().optional(),
}).superRefine((el, ctx) => {
  const requireField = (field: string, present: boolean) => {
    if (!present) {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: `Element type '${el.type}' thiếu field bắt buộc '${field}'`,
      })
    }
  }
  switch (el.type) {
    case 'text':
      requireField('text', el.text !== undefined)
      requireField('font', el.font !== undefined)
      requireField('fill', el.fill !== undefined)
      requireField('fitMode', el.fitMode !== undefined)
      requireField('maxLines', el.maxLines !== undefined)
      break
    case 'rect':
      requireField('fill', el.fill !== undefined)
      break
    case 'line':
      requireField('stroke', el.stroke !== undefined)
      requireField('strokeWidth', el.strokeWidth !== undefined)
      break
    case 'image':
      requireField('src', el.src !== undefined)
      break
    case 'path':
      requireField('d', el.d !== undefined)
      break
  }
})

export const Patch = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('update'), id: z.string(),
    path: z.string().regex(/^(props\.(text|fill|font|weight|align|fitMode|maxLines|stroke|strokeWidth|radius|src|d)|x|y|w|h|z|rotation)$/),
    valueStr: z.string().optional(), valueNum: z.number().optional(), valueBool: z.boolean().optional(),
  }).refine(p => [p.valueStr, p.valueNum, p.valueBool].filter(v => v !== undefined).length === 1,
    { message: 'Điền đúng 1 trong valueStr/valueNum/valueBool' }),
  z.object({ op: z.literal('add'), id: z.string(), after: z.string().optional(),
             element: AddElement }),   // hiện thực "+ superRefine theo type" (§6 dòng 345)
  z.object({ op: z.literal('remove'), id: z.string() }),
  z.object({ op: z.literal('none'), reason: z.string().min(3) }),
]).refine(p => p.op !== 'none' || true)

export const ExtractResult = z.object({
  page: z.object({ w: z.literal(210), h: z.literal(297) }),
  elements: z.array(z.object({
    id: z.string(), type: z.enum(['text', 'rect', 'line', 'image', 'path']),
    x: InPage, y: InPage, w: z.number().positive().max(215), h: z.number().positive().max(302),
    rotation: z.number().optional(), text: z.string().optional(),
    font: z.enum(['body', 'display', 'price']).optional(),
    fill: HexColor.optional(), stroke: HexColor.optional(),
    strokeWidth: z.number().positive().max(10).optional(),
    radius: z.number().min(0).max(50).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    fitMode: z.enum(['shrink-to-fit', 'wrap']).optional(),
    maxLines: z.number().int().min(1).max(6).optional(),
    src: z.string().optional(), d: z.string().optional(),
    confidence: z.number().min(0).max(1),
  })).max(60),
})

export const BatchResult = z.object({
  items: z.array(z.object({
    name: z.string().min(1), price: z.number().int().nonnegative(),
    unit: z.string().nullable(), discount: z.number().int().min(1).max(99).nullable(),
    confidence: z.number().min(0).max(1),
  })).min(1),
})

export const TagResult = z.object({
  name: z.string().min(3).max(60), description: z.string().min(10).max(200),
  tags: z.array(z.string()).min(3).max(7),
})

// ═══ A4DocSchema + ElSchema — tổng hợp cơ học từ docs/ARCHITECTURE.md §3 ═══
// Spec chưa định nghĩa code Zod cho A4Doc đích (§6 chỉ có ExtractResult flattened) —
// phần này tổng hợp cơ học từ §3, không field/bound nào ngoài spec; khác biệt muốn đổi →
// hỏi chủ sản phẩm trước (02-plan Câu hỏi mở 1).
// Quy tắc bound: field nào §6 đã có bound cho cùng loại field thì tái dùng (fill/stroke →
// HexColor; w → positive().max(215); h → positive().max(302); strokeWidth → positive().max(10);
// radius → min(0).max(50)); field §6 không có (grid cols/gapX/gapY, itemTemplate.h) → theo §3
// nguyên văn z.number() thuần, KHÔNG bịa bound.

const TextElSchema = ElementBase.extend({ type: z.literal('text'), props: TextProps })

const RectElSchema = ElementBase.extend({ type: z.literal('rect'), props: z.object({
  fill: HexColor, radius: z.number().min(0).max(50).optional(),
  stroke: HexColor.optional(), strokeWidth: z.number().positive().max(10).optional() }) })

const LineElSchema = ElementBase.extend({ type: z.literal('line'), props: z.object({
  stroke: HexColor, strokeWidth: z.number().positive().max(10) }) })

const ImageElSchema = ElementBase.extend({ type: z.literal('image'), props: z.object({
  src: z.string(), fit: z.enum(['cover', 'contain']) }) })

const PathElSchema = ElementBase.extend({ type: z.literal('path'), props: z.object({
  d: z.string(), fill: HexColor.optional(), stroke: HexColor.optional() }) })

// RepeatEl: bỏ dataBinding null của ElementBase rồi khai lại { source: 'items' } đúng §3
// (đối xứng với `RepeatEl extends Omit<BaseEl, 'dataBinding'>` ở doc.types.ts — 02-plan Quyết định 6).
const RepeatElSchema = ElementBase.omit({ dataBinding: true }).extend({
  type: z.literal('repeat'),
  dataBinding: z.object({ source: z.literal('items') }),
  itemTemplate: z.object({
    h: z.number(),                                  // §3 không định nghĩa bound — giữ z.number() thuần
    elements: z.array(z.lazy(() => ElSchema)),      // đệ quy: itemTemplate.elements là El[]
  }),
  grid: z.object({ cols: z.number(), gapX: z.number(), gapY: z.number() }),
  overflow: z.literal('paginate'),
})

// Chú thích type tường minh để vòng đệ quy qua z.lazy typecheck được (TS không tự suy diễn vòng).
export const ElSchema: z.ZodType<El> = z.discriminatedUnion('type', [
  TextElSchema, RectElSchema, LineElSchema, ImageElSchema, PathElSchema, RepeatElSchema,
])

export const A4DocSchema = z.object({
  schemaVersion: z.literal(1),
  page: z.object({ w: z.literal(210), h: z.literal(297), unit: z.literal('mm') }),
  elements: z.array(ElSchema),
})
