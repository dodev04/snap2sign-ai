import { redirect } from 'next/navigation'

// Trang gốc chuyển hướng sang editor (gói scaffold M1.1).
export default function Home() {
  redirect('/editor')
}
