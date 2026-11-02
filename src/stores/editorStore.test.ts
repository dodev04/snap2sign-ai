import { describe, expect, it } from 'vitest'
import type { A4Doc, El, TextEl } from '@/engine/doc.types'
import { createEditorStore } from './editorStore'

// Unit test thuần node cho editorStore M1.6 — client-state thuần, không DB/network
// (ngoại lệ no-mock AGENTS.md kiểm chứng 1). Engine applyPatches được gọi THẬT qua
// action của store — KHÔNG stub, KHÔNG vi.mock. Mỗi test tạo instance sạch qua
// factory createEditorStore (02-plan Bước 2) — không reset singleton, không mock.
// Fixture tự dựng tại chỗ theo style patch-apply.test.ts (không import demo-doc).

const doc = (elements: El[]): A4Doc => ({
  schemaVersion: 1,
  page: { w: 210, h: 297, unit: 'mm' },
  elements,
})

/** Text element tối thiểu hợp schema — id truyền vào để điều khiển fixture từng test. */
const el = (id: string): TextEl => ({
  id,
  type: 'text',
  x: 8,
  y: 8,
  w: 60,
  h: 12,
  z: 1,
  props: { text: id, font: 'body', fill: '#212121', fitMode: 'shrink-to-fit', maxLines: 1 },
})

// ─── 1-2. applyPatches wrapper engine ───

describe('editorStore — applyPatches (wrapper engine)', () => {
  it('1. apply hợp lệ: doc đổi + past = [doc cũ] + future [] + lastDiff khớp res.diffs engine', () => {
    const base = doc([el('E1'), el('E2')])
    const store = createEditorStore(base)
    const res = store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    expect(res.applied).toHaveLength(1)
    expect(res.skipped).toHaveLength(0)
    const s = store.getState()
    expect(s.doc).toBe(res.doc)
    expect(s.doc).not.toBe(base) // bản mới copy-on-write, bản gốc không bị mutate
    expect((s.doc.elements[0] as TextEl).x).toBe(20)
    expect(s.past).toEqual([base])
    expect(s.future).toEqual([])
    expect(s.lastDiff).toEqual(res.diffs)
    expect(s.lastDiff[0]).toMatchObject({ id: 'E1', field: 'x', oldValue: 8, newValue: 20 })
  })

  it('2. apply toàn skipped (id không tồn tại): doc giữ nguyên reference + past KHÔNG tăng + trả skipped có reason', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    const res = store.getState().applyPatches([{ op: 'update', id: 'E999', path: 'x', value: 20 }])
    expect(res.applied).toHaveLength(0)
    expect(res.skipped).toHaveLength(1)
    expect(res.skipped[0].reason).toContain("id 'E999' không tồn tại")
    const s = store.getState()
    expect(s.doc).toBe(base) // giữ nguyên reference — không set doc khi toàn skipped
    expect(s.past).toEqual([])
    expect(s.future).toEqual([])
    expect(s.lastDiff).toEqual([])
  })
})

// ─── 3. undo/redo luân phiên ───

describe('editorStore — undo/redo', () => {
  it('3. undo/redo luân phiên + no-op past/future rỗng + apply mới sau undo clear future', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    const v1 = store.getState().doc
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 30 }])
    const v2 = store.getState().doc
    expect(v2).not.toBe(v1)

    store.getState().undo()
    expect(store.getState().doc).toBe(v1) // về bản giữa
    expect(store.getState().future).toEqual([v2])
    store.getState().undo()
    expect(store.getState().doc).toBe(base) // về init
    expect(store.getState().past).toEqual([])
    store.getState().undo() // past rỗng → no-op
    expect(store.getState().doc).toBe(base)
    expect(store.getState().future).toEqual([v1, v2])

    store.getState().redo()
    expect(store.getState().doc).toBe(v1)
    store.getState().redo()
    expect(store.getState().doc).toBe(v2)
    store.getState().redo() // future rỗng → no-op
    expect(store.getState().doc).toBe(v2)
    expect(store.getState().past).toEqual([base, v1])

    store.getState().undo() // doc = v1, future = [v2]
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 40 }])
    expect(store.getState().future).toEqual([]) // apply mới sau undo → future bị clear
  })
})

// ─── 4-5. selection: deselect-on-remove + healing qua undo/redo ───

describe('editorStore — selection', () => {
  it('4. deselect-on-remove: chọn id → apply remove id đó → selectedId null', () => {
    const store = createEditorStore(doc([el('E1'), el('E2')]))
    store.getState().setSelection('E1')
    expect(store.getState().selectedId).toBe('E1')
    store.getState().applyPatches([{ op: 'remove', id: 'E1' }])
    expect(store.getState().selectedId).toBeNull()
  })

  it('5. selection healing: undo tới bản KHÔNG có element đang chọn → selectedId tự null; element quay lại KHÔNG hồi phục selection', () => {
    const base = doc([el('E1')]) // bản gốc KHÔNG có E2
    const store = createEditorStore(base)
    store.getState().applyPatches([{ op: 'add', id: 'E2', element: el('E2') }])
    store.getState().setSelection('E2')
    store.getState().undo() // về base — bản không có E2 → heal null
    expect(store.getState().doc).toBe(base)
    expect(store.getState().selectedId).toBeNull()
    store.getState().redo() // E2 quay lại — selection KHÔNG hồi phục (selection không thuộc undo)
    expect(store.getState().doc.elements.some((e) => e.id === 'E2')).toBe(true)
    expect(store.getState().selectedId).toBeNull()
    // Element đang chọn vẫn còn ở bản undo tới → selection giữ nguyên
    store.getState().setSelection('E1')
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    store.getState().undo()
    expect(store.getState().selectedId).toBe('E1')
  })
})

// ─── 6. cap 20 ───

describe('editorStore — cap undo 20', () => {
  it('6. apply 25 lần thay đổi thật → past.length = 20, bản cũ nhất rơi ra khỏi stack', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    const versions: A4Doc[] = [base]
    for (let i = 1; i <= 25; i++) {
      store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 100 + i }])
      versions.push(store.getState().doc)
    }
    const s = store.getState()
    expect(s.past).toHaveLength(20)
    // past sau 25 apply = [v0…v24] slice cuối 20 = [v5…v24] — base…v4 đã rơi khỏi stack.
    expect(s.past[0]).toBe(versions[5])
    expect(s.doc).toBe(versions[25])
  })
})

// ─── 7-9. gesture transaction 1C ───

describe('editorStore — gesture transaction (1 cử chỉ = 1 mục undo)', () => {
  it('7. begin → apply x3 → past KHÔNG tăng giữa chừng → end → past +1 chứa doc trước gesture; 1 undo đủ về điểm xuất phát', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    store.getState().beginGesture()
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    const v1 = store.getState().doc
    expect(store.getState().past).toEqual([]) // KHÔNG tăng giữa chừng
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 30 }])
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'y', value: 40 }])
    expect(store.getState().past).toEqual([])
    expect(store.getState().doc).not.toBe(v1) // doc vẫn đổi mỗi pointermove
    store.getState().undo() // đang gesture → no-op
    store.getState().redo() // đang gesture → no-op
    expect(store.getState().doc).not.toBe(base)
    store.getState().endGesture()
    expect(store.getState().past).toEqual([base]) // đúng 1 mục = doc trước gesture
    store.getState().undo()
    expect(store.getState().doc).toBe(base) // 1 lần undo đủ về điểm xuất phát
  })

  it('8. gesture không đổi doc (rung dưới ngưỡng, không apply nào chạy) → endGesture không sinh mục undo', () => {
    const store = createEditorStore(doc([el('E1')]))
    store.getState().beginGesture()
    store.getState().endGesture()
    expect(store.getState().past).toEqual([])
    expect(store.getState().gestureBaseDoc).toBeNull()
  })

  it('9. gesture treo: begin → apply → begin lại → gesture cũ tự commit đúng 1 mục, gesture mới tính từ doc hiện tại', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    store.getState().beginGesture()
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    const v1 = store.getState().doc
    store.getState().beginGesture() // gesture cũ còn treo → tự commit trước (heal)
    const s = store.getState()
    expect(s.past).toEqual([base]) // gesture cũ commit đúng 1 mục
    expect(s.gestureBaseDoc).toBe(v1) // gesture mới chốt doc hiện tại
    store.getState().endGesture() // gesture mới chưa đổi gì → không thêm mục
    expect(store.getState().past).toEqual([base])
  })
})

// ─── 10-11. snapshots ───

describe('editorStore — snapshots', () => {
  it('10. saveSnapshot: label "Phiên 1 — HH:MM" + doc là bản hiện tại; undo/redo sau đó KHÔNG đụng snapshots', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    const v1 = store.getState().doc
    store.getState().saveSnapshot()
    const snapshots = store.getState().snapshots
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].id).toMatch(/^snap-\d+$/)
    expect(snapshots[0].doc).toBe(v1) // lưu bản hiện tại
    expect(snapshots[0].label).toMatch(/^Phiên 1 — \d{2}:\d{2}$/)
    expect(snapshots[0].at).toBeGreaterThan(0)
    store.getState().undo() // lưu phiên bản KHÔNG phải thay đổi doc
    expect(store.getState().snapshots).toBe(snapshots) // giữ nguyên reference
    store.getState().redo()
    expect(store.getState().snapshots).toBe(snapshots)
    store.getState().saveSnapshot()
    expect(store.getState().snapshots[1].label).toMatch(/^Phiên 2 — \d{2}:\d{2}$/)
  })

  it('11. restoreSnapshot: doc về bản snapshot + past tăng 1 (restore undoable) + future clear; id sai → false không đổi gì; đang gesture → false', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    store.getState().saveSnapshot()
    const snap = store.getState().snapshots[0]
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    const v1 = store.getState().doc
    expect(store.getState().past).toEqual([base])

    expect(store.getState().restoreSnapshot(snap.id)).toBe(true)
    const s = store.getState()
    expect(s.doc).toBe(snap.doc) // về bản snapshot
    expect(s.past).toEqual([base, v1]) // push doc hiện tại vào past — restore là thay đổi undoable
    expect(s.future).toEqual([])
    store.getState().undo() // restore cũng undo được
    expect(store.getState().doc).toBe(v1)

    // id sai → false + không đổi gì (giữ nguyên reference mọi mảng)
    const before = store.getState()
    expect(store.getState().restoreSnapshot('snap-khong-co')).toBe(false)
    const after = store.getState()
    expect(after.doc).toBe(before.doc)
    expect(after.past).toBe(before.past)
    expect(after.future).toBe(before.future)
    // đang gesture → false
    store.getState().beginGesture()
    expect(store.getState().restoreSnapshot(snap.id)).toBe(false)
    store.getState().endGesture()
  })
})

// ─── 12. setSelection không thuộc undo ───

describe('editorStore — setSelection', () => {
  it('12. setSelection không push past/future (selection không thuộc undo)', () => {
    const store = createEditorStore(doc([el('E1'), el('E2')]))
    store.getState().setSelection('E1')
    store.getState().setSelection('E2')
    store.getState().setSelection(null)
    const s = store.getState()
    expect(s.selectedId).toBeNull()
    expect(s.past).toEqual([])
    expect(s.future).toEqual([])
  })
})

// ─── 13-17. pushChatEntry (M1.7 CommandBar — 02-plan Bước 2) ───

describe('editorStore — pushChatEntry (M1.7 CommandBar)', () => {
  it('13. push entry user hợp lệ: history +1 đúng { role, text } đã trim; KHÔNG đụng selection/doc/past/future/snapshots', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    store.getState().setSelection('E1')
    const before = store.getState()
    store.getState().pushChatEntry({ role: 'user', text: '  đổi hết giá sang màu đỏ  ' })
    const s = store.getState()
    expect(s.chatContext.history).toEqual([{ role: 'user', text: 'đổi hết giá sang màu đỏ' }]) // text đã trim
    expect(s.chatContext.selectedId).toBeNull() // KHÔNG set chatContext.selectedId (intent router M2)
    expect(s.selectedId).toBe('E1') // selection editor giữ nguyên
    expect(s.doc).toBe(before.doc)
    expect(s.past).toBe(before.past) // giữ nguyên reference và độ dài
    expect(s.future).toBe(before.future)
    expect(s.snapshots).toBe(before.snapshots)
  })

  it('14. isolation undo: push KHÔNG sinh mục undo; undo() sau push vẫn hoạt động và KHÔNG đụng chatContext', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    expect(store.getState().past).toHaveLength(1)
    store.getState().pushChatEntry({ role: 'user', text: 'tông đỏ đậm hơn' })
    expect(store.getState().past).toHaveLength(1) // past KHÔNG tăng sau push
    store.getState().undo() // undo vẫn hoạt động sau push
    expect(store.getState().doc).toBe(base)
    expect(store.getState().chatContext.history).toEqual([{ role: 'user', text: 'tông đỏ đậm hơn' }]) // history giữ nguyên
  })

  it('15. push text rỗng / toàn whitespace → no-op, chatContext giữ nguyên reference', () => {
    const store = createEditorStore(doc([el('E1')]))
    const before = store.getState().chatContext
    store.getState().pushChatEntry({ role: 'user', text: '' })
    store.getState().pushChatEntry({ role: 'ai', text: '   \t  ' })
    const s = store.getState()
    expect(s.chatContext).toBe(before) // giữ nguyên reference — không set gì khi rỗng
    expect(s.chatContext.history).toEqual([])
  })

  it('16. push nhiều entry → giữ thứ tự thời gian (mục cuối = mới nhất)', () => {
    const store = createEditorStore(doc([el('E1')]))
    store.getState().pushChatEntry({ role: 'user', text: 'lệnh thứ nhất' })
    store.getState().pushChatEntry({ role: 'ai', text: 'phản hồi thứ nhất' })
    store.getState().pushChatEntry({ role: 'user', text: 'lệnh thứ hai' })
    expect(store.getState().chatContext.history).toEqual([
      { role: 'user', text: 'lệnh thứ nhất' },
      { role: 'ai', text: 'phản hồi thứ nhất' },
      { role: 'user', text: 'lệnh thứ hai' },
    ])
  })

  it('17. push trong lúc gesture: gestureBaseDoc giữ nguyên giá trị, endGesture vẫn commit đúng 1 mục undo cho doc', () => {
    const base = doc([el('E1')])
    const store = createEditorStore(base)
    store.getState().beginGesture()
    store.getState().applyPatches([{ op: 'update', id: 'E1', path: 'x', value: 20 }])
    const g = store.getState().gestureBaseDoc
    expect(g).toBe(base)
    store.getState().pushChatEntry({ role: 'user', text: 'lệnh giữa cử chỉ kéo' })
    expect(store.getState().gestureBaseDoc).toBe(g) // chat không làm bẩn transaction 1C
    expect(store.getState().past).toEqual([]) // không push past giữa chừng gesture
    store.getState().endGesture()
    expect(store.getState().past).toEqual([base]) // endGesture vẫn commit đúng 1 mục
    expect(store.getState().chatContext.history).toEqual([{ role: 'user', text: 'lệnh giữa cử chỉ kéo' }])
  })
})
