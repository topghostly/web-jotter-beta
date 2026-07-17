import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Note, NoteColor, PaperType } from "./types.ts";
import styles from "./NoteCard.module.css";

interface NoteCardProps {
  note: Note;
  /** What to render — may differ from the note's own paper/color per settings. */
  paper: PaperType;
  color: NoteColor;
  deleteMode: boolean;
  removing?: boolean;
  justAdded?: boolean;
  onDelete: () => void;
  onBodyChange: (body: string) => void;
  onFlush: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function NoteCard({
  note,
  paper,
  color,
  deleteMode,
  removing,
  justAdded,
  onDelete,
  onBodyChange,
  onFlush,
}: NoteCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  /* The contentEditable is uncontrolled: React renders the body once, then
     the DOM owns it. Re-renders never touch the text, so the caret stays put. */
  const initialBody = useRef(note.body);

  useEffect(() => {
    if (justAdded) bodyRef.current?.focus();
  }, [justAdded]);

  function handleDeleteKey(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onDelete();
    }
  }

  const className = [
    styles.card,
    deleteMode && styles.deletable,
    removing && styles.removing,
    justAdded && styles.justAdded,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={className}
      data-paper={paper}
      data-color={color}
      onClick={deleteMode ? onDelete : undefined}
      onKeyDown={deleteMode ? handleDeleteKey : undefined}
      role={deleteMode ? "button" : undefined}
      aria-label={deleteMode ? "Delete this note" : undefined}
      tabIndex={deleteMode ? 0 : undefined}
    >
      <div
        ref={bodyRef}
        className={styles.body}
        contentEditable={!deleteMode && !removing}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Note text"
        data-placeholder="jot something…"
        onInput={(e) => onBodyChange(e.currentTarget.innerText)}
        onBlur={(e) => {
          onBodyChange(e.currentTarget.innerText.trim());
          onFlush();
        }}
      >
        {initialBody.current}
      </div>
      <time
        className={styles.date}
        dateTime={new Date(note.createdAt).toISOString()}
      >
        {formatDate(note.createdAt)}
      </time>
    </article>
  );
}
