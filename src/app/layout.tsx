import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Signboard Studio',
  description:
    'Chuyển ảnh biển bảng giá siêu thị/tạp hóa thành mẫu thiết kế vector chuẩn A4 chuẩn in.',
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
