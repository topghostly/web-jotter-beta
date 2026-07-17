export const PAPER_TYPES = ["plain", "ruled", "grid", "dot"] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

export const NOTE_COLORS = ["yellow", "pink", "blue", "mint", "white"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
  /** Client-generated id — the stable React key, even before the server knows the note. */
  id: string;
  /** MongoDB _id, set once the note has been created on the server. */
  serverId?: string;
  body: string;
  paper: PaperType;
  color: NoteColor;
  createdAt: number;
}
