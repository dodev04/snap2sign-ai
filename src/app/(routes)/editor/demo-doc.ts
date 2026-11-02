/**
 * Doc mẫu tạm M1.3 — M1.8 thay bằng 3 doc chuẩn (ROADMAP dòng 20).
 * Đủ cả 6 element type để QA-001 kiểm chứng preview trên browser; viết theo palette in
 * an toàn + token font SYSTEM_PROMPTS.md dòng 24-25; mọi element margin ≥ 8mm — riêng
 * rect nền full-page (x=0, y=0, w=210, h=297) được chạm mép (quy tắc dòng 20).
 * Tiếng Việt giữ nguyên dấu thanh; giá dạng "15.000đ"; % nguyên số "GIẢM 30%".
 */
import type { A4Doc } from '@/engine/doc.types'
import { A4DocSchema } from '@/engine/doc.zod'

const raw: A4Doc = {
  schemaVersion: 1,
  page: { w: 210, h: 297, unit: 'mm' },
  elements: [
    // Nền kem full-page — element duy nhất được chạm mép khổ giấy
    {
      id: 'E1', type: 'rect', x: 0, y: 0, w: 210, h: 297, z: 1,
      props: { fill: '#FFF8F0' },
    },
    // Tiêu đề display — Montserrat ExtraBold (token display)
    {
      id: 'E2', type: 'text', x: 8, y: 14, w: 194, h: 24, z: 2,
      props: {
        text: 'RAU CỦ SẠCH', font: 'display', weight: 900, fill: '#212121',
        align: 'center', fitMode: 'shrink-to-fit', maxLines: 1,
      },
    },
    // Băng vàng nhạt sau chữ giảm giá
    {
      id: 'E3', type: 'rect', x: 48, y: 44, w: 114, h: 18, z: 3,
      props: { fill: '#FFF3CD', radius: 2 },
    },
    // % giảm — Anton (token price), số nguyên + "%"
    {
      id: 'E4', type: 'text', x: 48, y: 44, w: 114, h: 18, z: 4,
      props: {
        text: 'GIẢM 30%', font: 'price', fill: '#D32F2F',
        align: 'center', fitMode: 'shrink-to-fit', maxLines: 1,
      },
    },
    // Giá lớn — dạng đầy đủ "15.000đ" (dấu chấm ngăn nghìn, không cách số-đ)
    {
      id: 'E5', type: 'text', x: 8, y: 70, w: 194, h: 30, z: 5,
      props: {
        text: '15.000đ', font: 'price', fill: '#D32F2F',
        align: 'center', fitMode: 'shrink-to-fit', maxLines: 1,
      },
    },
    // Line kẻ ngang
    {
      id: 'E6', type: 'line', x: 8, y: 104, w: 194, h: 0.5, z: 6,
      props: { stroke: '#212121', strokeWidth: 0.5 },
    },
    // Path họa tiết lá đơn giản (d là tọa độ tuyệt đối trang, chỉ stroke xanh lá).
    // rotation demo M1.4 — lá nghiêng tự nhiên, bbox xoay quanh tâm (23,124), làm bằng
    // chứng QA-001 "viền chọn đúng bbox xoay" (không chồng E6 y≈104 hay E8 x≥150).
    {
      id: 'E7', type: 'path', x: 8, y: 112, w: 30, h: 24, z: 7, rotation: -15,
      props: { d: 'M12 132 C12 118 28 114 34 120 C30 132 20 136 12 132 Z', stroke: '#2E7D32' },
    },
    // Image demo — asset tĩnh /demo/price-tag.svg (không phụ thuộc Storage M4.1)
    {
      id: 'E8', type: 'image', x: 150, y: 112, w: 52, h: 52, z: 8,
      props: { src: '/demo/price-tag.svg', fit: 'contain' },
    },
    // Vùng repeat nhỏ — expand ảo 1 cell đầu, giữ {{name}}/{{price}} literal (M3 mới có items)
    {
      id: 'E9', type: 'repeat', x: 8, y: 176, w: 194, h: 88, z: 9,
      dataBinding: { source: 'items' },
      itemTemplate: {
        h: 30,
        elements: [
          {
            id: 'E91', type: 'text', x: 0, y: 2, w: 80, h: 10, z: 1,
            props: {
              text: '{{name}}', font: 'body', fill: '#212121',
              fitMode: 'shrink-to-fit', maxLines: 1,
            },
          },
          {
            id: 'E92', type: 'text', x: 0, y: 14, w: 80, h: 12, z: 2,
            props: {
              text: '{{price}}', font: 'price', fill: '#D32F2F',
              fitMode: 'shrink-to-fit', maxLines: 1,
            },
          },
        ],
      },
      grid: { cols: 2, gapX: 4, gapY: 4 },
      overflow: 'paginate',
    },
    // Phụ chú body — không HOA toàn bộ câu phụ chú (quy tắc tiếng Việt dòng 32)
    {
      id: 'E10', type: 'text', x: 8, y: 272, w: 194, h: 10, z: 10,
      props: {
        text: 'Giá áp dụng hôm nay tại cửa hàng', font: 'body', fill: '#212121',
        align: 'center', fitMode: 'shrink-to-fit', maxLines: 1,
      },
    },
  ],
}

// Guard schema lúc module load — doc mẫu sai schema phải fail ngay, không chờ runtime UI.
export const demoDoc: A4Doc = A4DocSchema.parse(raw)
