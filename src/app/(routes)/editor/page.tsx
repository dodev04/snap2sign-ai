// Trang editor — M1.4: hit-testing chọn element — pointerdown → mm → elementAtPoint
// (engine) → viền chọn overlay (SelectableA4Preview bọc A4Preview M1.3).
// Việc sau: Quick Tap M1.5, editorStore M1.6, CommandBar M1.7, 3 doc mẫu chuẩn M1.8
// (docs/ROADMAP.md).
import SelectableA4Preview from '@/components/editor/SelectableA4Preview'
import { demoDoc } from './demo-doc'

export default function EditorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">AI Signboard Studio</h1>
      <p className="text-sm text-gray-500">
        Chạm hoặc click vào tờ A4 để chọn element — viền xanh chỉ bbox đã trừ rotation
      </p>

      {/* SelectableA4Preview: pointerdown → mm (getBoundingClientRect) → elementAtPoint
          (engine hit-test) → viền chọn overlay — theo docs/ARCHITECTURE.md §7 dòng 187 */}
      <SelectableA4Preview doc={demoDoc} />
    </main>
  )
}
