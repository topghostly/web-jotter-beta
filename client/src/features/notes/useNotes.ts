import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../components/toast/useToast.ts";
import { ApiError } from "../../lib/api.ts";
import {
  createNote as apiCreateNote,
  deleteNote as apiDeleteNote,
  updateNote as apiUpdateNote,
} from "./notesApi.ts";
import { createDraftNote } from "./notesStore.ts";
import type { Note } from "./types.ts";

const SAVE_DEBOUNCE_MS = 800;

/** Per-note sync bookkeeping, keyed by the note's client id. */
interface SyncState {
  timer?: number;
  inFlight: boolean;
  /** Body changed after the current/last save attempt started. */
  dirty: boolean;
  /** Note was removed from the board (delete may still be in flight). */
  deleted?: boolean;
}

export function useNotes(initialNotes: Note[]) {
  const toast = useToast();
  const [notes, setNotes] = useState<Note[]>(initialNotes);

  /* Mirror of `notes`, updated eagerly, so save callbacks and event
     handlers never read a stale closure. */
  const notesRef = useRef(notes);
  const sync = useRef(new Map<string, SyncState>());
  const hadFailure = useRef(false);

  const setAll = useCallback((update: (prev: Note[]) => Note[]) => {
    notesRef.current = update(notesRef.current);
    setNotes(notesRef.current);
  }, []);

  const getSync = useCallback((id: string): SyncState => {
    let state = sync.current.get(id);
    if (!state) {
      state = { inFlight: false, dirty: false };
      sync.current.set(id, state);
    }
    return state;
  }, []);

  const saveNote = useCallback(
    async (id: string, options: { keepalive?: boolean } = {}) => {
      const state = getSync(id);
      const note = notesRef.current.find((n) => n.id === id);
      if (!note || state.deleted) return;
      if (state.inFlight) {
        state.dirty = true;
        return;
      }
      if (note.body.trim() === "") {
        // Never send empty content — the server rejects it (400). Drafts stay
        // local; a cleared saved note keeps its last non-empty server copy.
        state.dirty = false;
        return;
      }

      state.inFlight = true;
      state.dirty = false;
      let failed = false;
      try {
        if (note.serverId) {
          await apiUpdateNote(note.serverId, note.body, options);
          toast.success("changes saved");
        } else {
          const created = await apiCreateNote(note.body, options);
          if (state.deleted) {
            // Deleted while the create was in flight — remove the orphan.
            void apiDeleteNote(created._id).catch(() => {});
            sync.current.delete(id);
            return;
          }
          setAll((prev) =>
            prev.map((n) =>
              n.id === id ? { ...n, serverId: created._id } : n,
            ),
          );
          toast.success("note added to the board");
        }
        // The per-save success toast doubles as the recovery signal.
        hadFailure.current = false;
      } catch (error) {
        failed = true;
        if (!state.deleted) {
          if (error instanceof ApiError && error.status === 401) {
            state.dirty = true;
            hadFailure.current = true;
            toast.error("Your session expired — please log in again");
          } else if (
            error instanceof ApiError &&
            (error.status === 400 || error.status === 404)
          ) {
            // Permanent failure (validation, or the note was deleted
            // elsewhere) — retrying can't succeed. Keep the text locally.
            state.dirty = false;
          } else {
            state.dirty = true;
            hadFailure.current = true;
            toast.error("Couldn't save your note — we'll keep retrying");
          }
        }
      } finally {
        state.inFlight = false;
      }

      // A body change arrived during the save — send one trailing save.
      if (!failed && state.dirty && !state.deleted) void saveNote(id, options);
    },
    [getSync, setAll, toast],
  );

  const scheduleSave = useCallback(
    (id: string) => {
      const state = getSync(id);
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => {
        state.timer = undefined;
        void saveNote(id);
      }, SAVE_DEBOUNCE_MS);
    },
    [getSync, saveNote],
  );

  const addNote = useCallback((): string => {
    const note = createDraftNote();
    setAll((prev) => [note, ...prev]);
    return note.id;
  }, [setAll]);

  const updateNoteBody = useCallback(
    (id: string, body: string) => {
      const current = notesRef.current.find((n) => n.id === id);
      if (!current || current.body === body) return;
      setAll((prev) => prev.map((n) => (n.id === id ? { ...n, body } : n)));
      scheduleSave(id);
    },
    [scheduleSave, setAll],
  );

  /** Immediate save of anything pending or dirty — used on blur. */
  const flushNote = useCallback(
    (id: string) => {
      const state = getSync(id);
      if (!state.timer && !state.dirty) return;
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = undefined;
      }
      void saveNote(id);
    },
    [getSync, saveNote],
  );

  const removeNote = useCallback(
    (id: string) => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return;
      const state = getSync(id);
      state.deleted = true;
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = undefined;
      }
      const index = notesRef.current.indexOf(note);
      setAll((prev) => prev.filter((n) => n.id !== id));
      toast.success("note torn off the board");

      if (!note.serverId) {
        // Unsaved draft. If a create is in flight, saveNote cleans up after it.
        if (!state.inFlight) sync.current.delete(id);
        return;
      }

      apiDeleteNote(note.serverId)
        .then(() => sync.current.delete(id))
        .catch(() => {
          state.deleted = false;
          setAll((prev) => {
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, note);
            return next;
          });
          toast.error("Couldn't delete the note — it's back on your board");
        });
    },
    [getSync, setAll, toast],
  );

  /* Last-chance flush when the tab is hidden/closed. keepalive lets the
     browser finish the request after the page goes away. */
  useEffect(() => {
    function flushPending() {
      for (const note of notesRef.current) {
        const state = sync.current.get(note.id);
        if (state?.timer || state?.dirty) {
          if (state.timer) {
            window.clearTimeout(state.timer);
            state.timer = undefined;
          }
          void saveNote(note.id, { keepalive: true });
        }
      }
    }
    window.addEventListener("pagehide", flushPending);
    return () => window.removeEventListener("pagehide", flushPending);
  }, [saveNote]);

  return { notes, addNote, updateNoteBody, flushNote, removeNote };
}
