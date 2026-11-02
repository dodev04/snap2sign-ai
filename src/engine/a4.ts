/**
 * Hằng số khổ giấy A4 — trích từ docs/ARCHITECTURE.md §3:
 * "Đơn vị: mm tuyệt đối, khổ A4 210×297" (`page: { w: 210; h: 297; unit: 'mm' }`).
 * Engine dùng chung hệ tọa độ mm này cho cả SVG preview lẫn PDF renderer.
 */
export const A4 = { w: 210, h: 297, unit: 'mm' } as const
