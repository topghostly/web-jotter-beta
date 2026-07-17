import Note from "../models/Note.js";
import { HttpError } from "../utils/HttpError.js";

async function loadOwnedNote(noteId, userId) {
  const note = await Note.findById(noteId);
  if (!note || !note.user.equals(userId)) {
    throw new HttpError(404, "Note not found");
  }
  return note;
}

export async function createNote(req, res) {
  const { content } = req.body;
  if (!content) {
    throw new HttpError(400, "content is required");
  }
  const note = await Note.create({ content, user: req.user.id });
  res.status(201).json({ note });
}

export async function updateNote(req, res) {
  const note = await loadOwnedNote(req.params.id, req.user.id);
  if (req.body.content !== undefined) {
    note.content = req.body.content;
  }
  await note.save();
  res.json({ note });
}

export async function deleteNote(req, res) {
  const note = await loadOwnedNote(req.params.id, req.user.id);
  await note.deleteOne();
  res.status(204).send();
}
