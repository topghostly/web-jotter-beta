/**
 * Maps server notes to the client shape. Paper and color aren't stored
 * server-side — they're re-randomized on every load, by design.
 */
import type { ApiNote } from "../../lib/api.ts";
import { newId } from "../../lib/id.ts";
import { NOTE_COLORS, PAPER_TYPES, type Note } from "./types.ts";

function pick<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

export function fromApiNote(apiNote: ApiNote): Note {
  return {
    id: newId(),
    serverId: apiNote._id,
    body: apiNote.content,
    paper: pick(PAPER_TYPES),
    color: pick(NOTE_COLORS),
    createdAt: Date.parse(apiNote.createdAt),
  };
}

/** A brand-new local note; POSTed to the server on its first non-empty save. */
export function createDraftNote(): Note {
  return {
    id: newId(),
    body: "",
    paper: pick(PAPER_TYPES),
    color: pick(NOTE_COLORS),
    createdAt: Date.now(),
  };
}
