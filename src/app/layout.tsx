import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Signboard Studio',
  description:
    'Chuyển ảnh biển bảng giá siêu thị/tạp hóa thành mẫu thiết kế vector chuẩn A4 chuẩn in.',
}

// M1.7: iOS Safari — bàn phím mở thì viewport THU NHỎ thay vì che nội dung, pill/ô
// nhập CommandBar sống sót khi gõ (skill signboard-frontend:76, docs/ROADMAP.md:96).
// Phần `100dvh` đã có qua `min-h-dvh` ở editor/page.tsx — không thêm gì nữa.
export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <body className="font-body bg-white text-gray-900 antialiased">{children}</body>
    </html>
  )
}
