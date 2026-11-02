// Trang editor placeholder tĩnh cho gói scaffold M1.1 — chưa có logic editor.
// M1.3 sẽ thay khung A4 trống dưới đây bằng component A4Preview.tsx
// (src/components/editor/A4Preview.tsx) theo docs/ARCHITECTURE.md §7.
export default function EditorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">AI Signboard Studio</h1>
      <p className="text-sm text-gray-500">
        Trình soạn thảo biển bảng giá — bản khung M1.1, chưa có tính năng
      </p>

      {/* M1.3 sẽ thay bằng A4Preview.tsx — hiện chỉ là khung tờ A4 trống */}
      <div className="aspect-[210/297] w-full max-w-[420px] border border-gray-300 bg-white shadow-sm" />
    </main>
  )
}
