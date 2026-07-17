import { api, type ApiNote } from "../../lib/api.ts";

export function createNote(
  content: string,
  options: { keepalive?: boolean } = {},
): Promise<ApiNote> {
  return api<{ note: ApiNote }>("/notes", {
    method: "POST",
    body: JSON.stringify({ content }),
    keepalive: options.keepalive,
  }).then((response) => response.note);
}

export function updateNote(
  id: string,
  content: string,
  options: { keepalive?: boolean } = {},
): Promise<ApiNote> {
  return api<{ note: ApiNote }>(`/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
    keepalive: options.keepalive,
  }).then((response) => response.note);
}

export function deleteNote(id: string): Promise<void> {
  return api<void>(`/notes/${id}`, { method: "DELETE" });
}
