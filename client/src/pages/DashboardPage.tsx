import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button.tsx";
import { useToast } from "../components/toast/useToast.ts";
import TopBar from "../features/dashboard/TopBar.tsx";
import NoteCard from "../features/notes/NoteCard.tsx";
import { fromApiNote } from "../features/notes/notesStore.ts";
import { useNotes } from "../features/notes/useNotes.ts";
import {
  applyTheme,
  FONT_SIZES,
  fromApiSettings,
} from "../features/settings/settingsStore.ts";
import { useSettings } from "../features/settings/useSettings.ts";
import { api, ApiError, type MeResponse } from "../lib/api.ts";
import styles from "./DashboardPage.module.css";
import { logout } from "../features/auth/authApi.ts";

const TEAR_OFF_MS = 220;

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthed, setUnauthed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<MeResponse>("/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setUnauthed(true);
        } else {
          setError(
            error instanceof Error ? error.message : "something went wrong",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (unauthed) return <Navigate to="/login" replace />;

  if (error) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.empty}>couldn't load your board — {error}</p>
          <div className={styles.retry}>
            <Button
              type="button"
              onClick={() => {
                setError(null);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!me) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.empty}>fetching your notes…</p>
        </main>
      </div>
    );
  }

  return <Dashboard me={me} />;
}

function Dashboard({ me }: { me: MeResponse }) {
  const navigate = useNavigate();
  const toast = useToast();
  const initialNotes = useMemo(() => me.notes.map(fromApiNote), [me.notes]);
  const { notes, addNote, updateNoteBody, flushNote, removeNote } =
    useNotes(initialNotes);
  const initialSettings = useMemo(
    () => fromApiSettings(me.settings),
    [me.settings],
  );
  const { settings, updateSettings } = useSettings(initialSettings);
  const [deleteMode, setDeleteMode] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!deleteMode) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDeleteMode(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteMode]);

  function handleAddNote() {
    setDeleteMode(false);
    setLastAddedId(addNote());
  }

  function handleDelete(id: string) {
    if (removingIds.includes(id)) return;
    setRemovingIds((prev) => [...prev, id]);
    setTimeout(() => {
      removeNote(id);
      setRemovingIds((prev) => prev.filter((x) => x !== id));
    }, TEAR_OFF_MS);
  }

  async function handleLogout() {
    applyTheme("light");
    try {
      await logout();
      toast.success("logged out — see you soon");
    } catch {
      // Leave the page regardless; the server session will lapse on its own.
    }
    navigate("/login", { replace: true });
  }

  const font = FONT_SIZES[settings.fontSize];
  const boardStyle = {
    "--note-fs": `${font.size}px`,
    "--note-lh": `${font.line}px`,
  } as CSSProperties;

  return (
    <div className={styles.page}>
      <TopBar
        username={me.user.name}
        deleteMode={deleteMode}
        settings={settings}
        onSettingsChange={updateSettings}
        onAddNote={handleAddNote}
        onToggleDeleteMode={() => setDeleteMode((on) => !on)}
        onLogout={handleLogout}
      />

      <main className={styles.main}>
        {deleteMode && notes.length > 0 && (
          <p className={styles.hint}>tap a note to tear it off the board</p>
        )}

        {notes.length === 0 ? (
          <p className={styles.empty}>
            an empty board — press “New note” and jot something down
          </p>
        ) : (
          <div className={styles.board} style={boardStyle}>
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                paper={
                  settings.paper === "random" ? note.paper : settings.paper
                }
                color={settings.multicolor ? note.color : "white"}
                deleteMode={deleteMode}
                removing={removingIds.includes(note.id)}
                justAdded={note.id === lastAddedId}
                onDelete={() => handleDelete(note.id)}
                onBodyChange={(body) => updateNoteBody(note.id, body)}
                onFlush={() => flushNote(note.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
