/**
 * editorStore — Zustand store của editor (gói M1.6 Undo/Snapshot).
 *
 * Nguồn:
 * - docs/ARCHITECTURE.md §5 — shape EditorStore 7 fields: doc/selectedId/past/future/
 *   snapshots/lastDiff/chatContext/dirty. Tạo ĐỦ shape ngay từ M1.6 (02-plan Quyết định 5):
 *   hành vi thật của gói này chỉ ở doc/selectedId/past/future/snapshots — lastDiff là
 *   M2 HighlightOverlay (ghi mỗi apply nhưng chưa có UI tiêu thụ), chatContext.history
 *   được push từ M1.7 qua CommandBar (pushChatEntry) còn chatContext.selectedId đích
 *   intent là M2, dirty là M4 autosave (giữ giá trị khởi tạo, tránh migrate store sau này).
 * - docs/ARCHITECTURE.md §4 bước 4 — "đẩy state cũ vào undo stack (cap 20)" khi áp patch;
 *   engine thuần KHÔNG tự đẩy undo (không phụ thuộc store) — store wrapper đẩy tại đây.
 * - docs/ROADMAP.md M1.6 — "store `past/future` cap 20 + snapshots + nút 'Lưu phiên bản'".
 * - 02-plan 20261102-m1-6-undo-snapshot Quyết định 1 (transaction 1C): 1 cử chỉ kéo —
 *   bao nhiêu pointermove đi nữa — = đúng 1 mục undo (beginGesture/endGesture); rung
 *   dưới ngưỡng 1.5mm không có patch nào chạy → không sinh mục undo rác.
 * - Snapshots IN-MEMORY trong phiên (orchestrator đã chốt — mất khi refresh là hành vi
 *   ĐÚNG; bảng DB `snapshots` là M4, docs/DATABASE.md:12) — KHÔNG persist middleware.
 * - Engine `applyPatches` tái dùng NGUYÊN TRẠNG (import alias `engineApplyPatches`).
 *   Store KHÔNG BAO GIỜ mutate doc: mọi biến đổi đi qua engine copy-on-write
 *   (patch-apply.ts:87-96) hoặc gán reference snapshot/undo.
 *
 * Zustand v5 (Quyết định 9): `create`/`createStore` + `(set, get)`, không middleware.
 * Export `useEditorStore` singleton cho React (page editor) + `createEditorStore`
 * (vanilla) cho unit test — mỗi test một instance sạch, không reset singleton.
 */
import { create, createStore } from 'zustand'
import type { StateCreator } from 'zustand'
import type { A4Doc, Patch } from '@/engine/doc.types'
import { applyPatches as engineApplyPatches } from '@/engine/patch-apply'
import type { ApplyResult, Diff } from '@/engine/patch-apply'
import { demoDoc } from '@/app/(routes)/editor/demo-doc'

/** docs/ARCHITECTURE.md §5 — mục snapshot trong `snapshots[]`. */
export interface EditorSnapshot {
  id: string
  label: string
  doc: A4Doc
  at: number
}

export interface EditorStore {
  // ─── State — 7 fields shape §5 + 1 field transaction nội bộ ───
  doc: A4Doc
  selectedId: string | null
  /** Undo stack — bản cuối = gần nhất; cap UNDO_CAP (20), bản cũ nhất rơi ra khi vượt. */
  past: A4Doc[]
  /** Redo stack — bị clear khi có thay đổi mới; tự bounded (≤ past ≤ 20 nên không cần cap). */
  future: A4Doc[]
  snapshots: EditorSnapshot[]
  /** Diff của lệnh apply gần nhất — HighlightOverlay (M2) tiêu thụ; chưa có UI M1.6. */
  lastDiff: Diff[]
  /** Gửi kèm intent AI — `history` push từ M1.7 qua CommandBar (pushChatEntry); `selectedId` đích intent là M2. */
  chatContext: { selectedId: string | null; history: { role: 'user' | 'ai'; text: string }[] }
  /** Autosave debounce → upsert templates — M4; giữ false ở M1.6. */
  dirty: boolean
  /**
   * Doc tại beginGesture — transaction 1C (02-plan Quyết định 1), ngoài shape §5:
   * trong lúc kéo, applyPatches chỉ đổi doc KHÔNG push past; endGesture push đúng
   * 1 mục = gestureBaseDoc nếu doc đã đổi. null = không có gesture nào đang chạy.
   */
  gestureBaseDoc: A4Doc | null

  // ─── Actions (pattern Zustand phẳng — state + actions cùng object) ───
  setSelection(id: string | null): void
  /** Wrapper engine applyPatches: đẩy past cap 20 + deselect-on-remove; trả ApplyResult nguyên vẹn. */
  applyPatches(patches: Patch[]): ApplyResult
  undo(): void
  redo(): void
  saveSnapshot(): void
  restoreSnapshot(id: string): boolean
  beginGesture(): void
  endGesture(): void
  /**
   * M1.7 CommandBar wire (AI thật là M2 — 02-plan Quyết định 1A/2A): push 1 mục vào
   * `chatContext.history`. KHÔNG thuộc undo — `chatContext` không phải `A4Doc`: action
   * chỉ set `chatContext`, tuyệt đối không đụng past/future/doc/gestureBaseDoc/snapshots.
   * KHÔNG set `chatContext.selectedId` (đó là intent router M2). Text trim rỗng → no-op
   * (giữ reference cũ). Không cap history (spec chưa định nghĩa — in-memory theo 2A).
   */
  pushChatEntry(entry: { role: 'user' | 'ai'; text: string }): void
}

/** PRD §3 "Undo stack ~20 bước" + ARCHITECTURE §4 bước 4 "cap 20". */
const UNDO_CAP = 20

/** Đẩy doc vào undo stack giữ cap 20 — bản cũ nhất rơi ra khi vượt. */
const pushPast = (past: A4Doc[], doc: A4Doc): A4Doc[] => [...past, doc].slice(-UNDO_CAP)

/**
 * Selection healing: sau undo/redo/restore, id đang chọn không còn trong doc mới → null
 * (nhất quán deselect-on-remove M1.5 page.tsx:37; selection KHÔNG thuộc undo — §5 past
 * chỉ chứa A4Doc, nên undo KHÔNG hồi phục selection).
 */
const healSelection = (doc: A4Doc, selectedId: string | null): string | null =>
  selectedId !== null && doc.elements.some((el) => el.id === selectedId) ? selectedId : null

/** Label phiên tự sinh: `Phiên {n} — HH:MM` (24h giờ địa phương, pad 2 chữ số — Quyết định 4). */
const snapshotLabel = (n: number): string => {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `Phiên ${n} — ${hh}:${mm}`
}

/** Counter id snapshot module-scope — deterministic cho test, không randomUUID (Quyết định 4). */
let snapshotCounter = 0

/** Initializer dùng chung cho singleton React + factory test (02-plan Bước 1). */
export const editorStoreCreator =
  (initDoc: A4Doc): StateCreator<EditorStore, [], []> =>
  (set, get) => ({
    doc: initDoc,
    selectedId: null,
    past: [],
    future: [],
    snapshots: [],
    lastDiff: [],
    chatContext: { selectedId: null, history: [] },
    dirty: false,
    gestureBaseDoc: null,

    setSelection: (id) => set({ selectedId: id }),

    applyPatches: (patches) => {
      const res = engineApplyPatches(get().doc, patches)
      if (res.applied.length === 0) {
        // Toàn bộ skipped: KHÔNG set doc (giữ reference cũ — tránh re-render vô ích và
        // cho endGesture so reference chính xác), không sinh mục undo; trả res đủ skipped.
        set({ lastDiff: [] })
        return res
      }
      const state = get()
      const next: Partial<EditorStore> = { doc: res.doc, lastDiff: res.diffs }
      if (state.gestureBaseDoc === null) {
        // Ngoài gesture: 1 lệnh apply = 1 mục undo; thay đổi mới xóa nhánh redo.
        next.past = pushPast(state.past, state.doc)
        next.future = []
      }
      // Trong gesture: chỉ đổi doc — endGesture sẽ push đúng 1 mục cho cả cử chỉ.
      if (state.selectedId !== null && res.applied.some((p) => p.op === 'remove' && p.id === state.selectedId)) {
        next.selectedId = null
      }
      set(next)
      return res
    },

    undo: () => {
      const state = get()
      if (state.gestureBaseDoc !== null || state.past.length === 0) return
      const doc = state.past[state.past.length - 1]
      set({
        future: [state.doc, ...state.future],
        past: state.past.slice(0, -1),
        doc,
        selectedId: healSelection(doc, state.selectedId),
      })
    },

    redo: () => {
      const state = get()
      if (state.gestureBaseDoc !== null || state.future.length === 0) return
      const doc = state.future[0]
      set({
        past: pushPast(state.past, state.doc),
        future: state.future.slice(1),
        doc,
        selectedId: healSelection(doc, state.selectedId),
      })
    },

    saveSnapshot: () => {
      const { snapshots, doc } = get()
      snapshotCounter += 1
      set({
        snapshots: [
          ...snapshots,
          {
            id: `snap-${snapshotCounter}`,
            label: snapshotLabel(snapshots.length + 1),
            doc, // bản hiện tại — lưu phiên bản KHÔNG phải thay đổi doc (không đụng past/future)
            at: Date.now(),
          },
        ],
      })
    },

    restoreSnapshot: (id) => {
      const state = get()
      if (state.gestureBaseDoc !== null) return false
      const snapshot = state.snapshots.find((s) => s.id === id)
      if (snapshot === undefined) return false
      set({
        past: pushPast(state.past, state.doc), // restore là thay đổi undoable
        future: [],
        doc: snapshot.doc,
        selectedId: healSelection(snapshot.doc, state.selectedId),
      })
      return true
    },

    beginGesture: () => {
      // Gesture cũ còn treo (vd unmount giữa chừng) → tự commit trước để không hỏng stack.
      if (get().gestureBaseDoc !== null) get().endGesture()
      set({ gestureBaseDoc: get().doc })
    },

    endGesture: () => {
      const g = get().gestureBaseDoc
      if (g === null) return // idempotent — no-op an toàn khi không có gesture
      const { doc, past } = get()
      set({ gestureBaseDoc: null })
      // Doc không đổi (rung dưới ngưỡng — không patch nào chạy) → KHÔNG sinh mục undo rác.
      if (doc === g) return
      set({ past: pushPast(past, g), future: [] })
    },

    // M1.7 — xem docblock trong interface: cách ly khỏi undo stack, chỉ đổi chatContext.
    pushChatEntry: (entry) => {
      const text = entry.text.trim()
      if (text === '') return
      const { chatContext } = get()
      set({ chatContext: { ...chatContext, history: [...chatContext.history, { role: entry.role, text }] } })
    },
  })

/** Singleton cho React (page editor) — init bằng demoDoc (M1.5 giữ nguyên, M1.6 nâng lên store). */
export const useEditorStore = create<EditorStore>()(editorStoreCreator(demoDoc))

/** Factory vanilla cho unit test — mỗi test một instance sạch, không đụng singleton. */
export const createEditorStore = (doc: A4Doc = demoDoc) => createStore(editorStoreCreator(doc))
