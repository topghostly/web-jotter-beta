# Jotter client ↔ API integration — design

**Date:** 2026-07-16
**Status:** Approved direction, pending spec review
**Scope:** Replace the client's localStorage stubs (auth, notes, settings) with real calls to the Jotter API per `api.json` (OpenAPI 0.1.0).

## Context

The client currently persists everything in localStorage behind three seams: `features/auth/authApi.ts`, `features/notes/notesStore.ts`, and `features/settings/settingsStore.ts`. The server (Express + MongoDB, see `../docker-compose.yml`) authenticates with a sliding-window JWT in an httpOnly `jotter_session` cookie. Both client and server run under docker-compose: the client's Vite dev server reaches the API at `http://server:8001` inside the compose network; from a local (non-Docker) shell the API is port-mapped to `http://localhost:8001`.

## Decisions made during brainstorming

- **Transport:** Vite dev proxy (`/api/*` → server), keeping requests same-origin so the httpOnly cookie needs no CORS/credentials work.
- **Per-note paper/color** (used when `paper` setting is `random` or `multicolor` is on): randomized client-side each time notes are loaded from the server. Reshuffling per session is acceptable; no id-hashing, no server schema change.
- **Note saving:** debounced autosave (UI-instant, PATCH ~800 ms after typing pauses, flush on blur and `pagehide`). A localStorage write-behind/offline layer was considered and rejected as premature complexity; the `notesApi` seam allows adding it later.
- **Logout:** client-side only (drop state, navigate to `/login`). Known limitation: the API has no logout endpoint and JS cannot clear an httpOnly cookie, so the session cookie stays valid until it expires. Revisit when the server adds `POST /users/logout`.
- **Data layer:** plain typed `fetch` wrapper + feature hooks. No new dependencies (TanStack Query rejected: the app has one read — `GET /me` — and a handful of mutations).
- **Out of scope:** account deletion (`DELETE /me`) — no UI exists for it today.

## Architecture

### 1. Transport — `src/lib/api.ts` + Vite proxy

- `vite.config.ts`: proxy `/api` → `process.env.VITE_API_TARGET ?? "http://server:8001"`, stripping the `/api` prefix. Local non-Docker runs set `VITE_API_TARGET=http://localhost:8001`.
- `src/lib/api.ts` exports:
  - `api<T>(path, init?)` — prefixes `/api`, sends/parses JSON, returns `T` on 2xx (`undefined` for 204), throws `ApiError` otherwise.
  - `class ApiError extends Error { status: number }` — message taken from the server's `{ error }` body, with a generic fallback.
  - Server DTO types: `PublicUser`, `ApiNote` (`_id`, `content`, `user`, `createdAt`, `updatedAt`), `ApiSettings`, and the `/me` payload `MeResponse { user, notes, settings }`.

### 2. Auth — rewrite `features/auth/authApi.ts`

- `signup(name, email, password)` → `POST /users`; `login(email, password)` → `POST /users/login`. Both return `PublicUser`. The cookie is set by the server; the client stores nothing.
- Delete the localStorage session helpers (`getSession`, `clearSession`, `SESSION_KEY`).
- `AuthForm.tsx`: add an **email** field (both modes) and a **name** field (signup only). Client-side validation: name ≥ 1 char (signup), email matches a simple pattern, password ≥ 6 chars. Server errors map to the form: 409 → email field ("email already in use"), 401 → form-level "invalid email or password", 400 → form-level server message. Network failures → form-level "couldn't reach the server".
- On success navigate to `/dashboard`.

### 3. Session bootstrap & route guard — `DashboardPage.tsx`

- On mount, fetch `GET /me` once.
  - **Pending:** lightweight loading state in the existing page styling.
  - **401:** `<Navigate to="/login" replace />`.
  - **Other errors:** inline error message with a retry button.
  - **Success:** render `<Dashboard>` with `user`, and seed `useNotes` / `useSettings` with the returned notes and settings.
- The old synchronous `getSession()` guard is removed. Auth pages do not probe `/me`; visiting `/login` while holding a valid cookie just shows the login page.

### 4. Notes — new `features/notes/notesApi.ts`, rework `useNotes` and `notesStore.ts`

- `notesApi.ts`: `createNote(content)` → `POST /notes`; `updateNote(id, content)` → `PATCH /notes/:id`; `deleteNote(id)` → `DELETE /notes/:id`.
- Client `Note` type stays the UI's shape (`id`, `body`, `paper`, `color`, `createdAt`). A mapper converts `ApiNote` → `Note` (`_id`→`id`, `content`→`body`, `Date.parse(createdAt)`), assigning random `paper`/`color` at map time (the per-session randomization decision).
- Seed notes (`SEEDS`) and all localStorage persistence are deleted; the existing empty-board message handles new accounts.
- **Draft notes:** `POST /notes` rejects empty content, but the UI creates a blank note to type into. New notes are created locally with a temporary id and a `draft` flag; the first debounced save with non-empty content POSTs, then the note's `id` is replaced with the server id in state. Because `id` is the React `key`, this remounts the card; the swap happens on a debounced save (not per keystroke), and if focus loss proves noticeable during implementation, keep the temp id as a stable `key` alongside a `serverId` field instead. Deleting a never-saved draft is local-only. Drafts that remain empty are simply never sent.
- **Debounced sync in `useNotes(initialNotes)`:** per-note timer (~800 ms) started on body change; flush on note blur and on `pagehide` (using `fetch` with `keepalive: true`). Latest-content-wins per note; a save already in flight is followed by one trailing save if the body changed meanwhile.
- **Failures:** keep local state; a failed save retries on the next change/flush. Deletes are optimistic; on failure the note is restored to the board.

### 5. Settings — new `features/settings/settingsApi.ts`, rework `useSettings` / `settingsStore.ts`

- `settingsApi.ts`: `updateSettings(patch)` → `PATCH /settings` with only the changed subset.
- `useSettings(initialSettings)`: optimistic local update + `applyTheme`, then PATCH. On failure keep the optimistic value; retry on the next settings change.
- Remove localStorage settings persistence. `settingsStore.ts` retains the pure things (types, option lists, `FONT_SIZES`, `applyTheme`); a mapper strips `_id`/`user` from `ApiSettings`.
- Pre-auth screens use the default light theme (no persisted theme flash-fix; acceptable).

### 6. Logout — `TopBar` → `DashboardPage.handleLogout`

- Clear component state and `navigate("/login", { replace: true })`. Code comment documents the still-valid cookie limitation.

### 7. Toasts — new `src/components/toast/`

A small, professional toast system for infos and errors. No dependency added; icons from the existing `lucide-react`.

- **API:** `ToastProvider` wraps the app in `App.tsx`; `useToast()` returns `{ info(message), error(message) }`. A `<Toaster />` inside the provider renders the stack.
- **Look:** consistent with the ink-on-paper design system — compact card using the existing `tokens.css` variables, subtle border + soft shadow, theme-aware (light/dark), leading icon (`Info` / `AlertCircle`), trailing dismiss (`X`). Bottom-right stack, newest on top, gentle slide-up + fade entrance and fade exit. Max ~3 visible; older ones drop off.
- **Behavior:** auto-dismiss (infos 4 s, errors 6 s), manual dismiss always available. Duplicate suppression: firing a toast whose message matches one on screen refreshes that toast's timer instead of stacking a copy (prevents spam while the server is down and retries fail).
- **Accessibility:** container is `aria-live` (`polite` for info, errors rendered with `role="alert"`); dismiss buttons are labelled.
- **Usage:** error toasts for failed note saves ("Couldn't save your note — we'll keep retrying"), failed deletes (alongside restoring the note), and failed settings saves. One info toast when a previously failed save later succeeds ("All changes synced"). Auth forms keep inline errors only — no duplicate toasts. The `/me` bootstrap keeps its full-page retry UI.

## Error handling summary

| Surface | Behavior |
|---|---|
| Auth forms | Field/form errors from `ApiError.message` (inline, no toast) |
| `/me` bootstrap | 401 → redirect; other → full-page retry UI |
| Note/settings saves | Keep local state, retry on next change + error toast (deduped); info toast when sync recovers |
| Note delete | Optimistic; restore on failure + error toast |

## Testing

Manual end-to-end against the compose stack (no test runner exists in the repo):
1. Sign up → lands on empty dashboard; cookie set.
2. Create note, type, wait > 800 ms → PATCH visible in network tab; reload → content persists, colors reshuffle.
3. Fast typing → only trailing PATCH fires; blur → immediate flush.
4. Delete note → gone after reload. Delete a fresh empty draft → no network call.
5. Change each setting → persists across reload and a second browser.
6. Login with wrong password → form error; duplicate signup email → email error.
7. Logout → back at login; dashboard redirects only after cookie expiry (documented limitation).
8. Stop the server mid-edit → typing keeps working, one deduped error toast shows; restart → next edit syncs and an "All changes synced" info toast appears.
9. Toasts: stack correctly, auto-dismiss on their timers, dismiss manually, render properly in both light and dark themes.

## Files touched

- **New:** `src/lib/api.ts`, `src/features/notes/notesApi.ts`, `src/features/settings/settingsApi.ts`, `src/components/toast/` (`ToastProvider.tsx`, `Toaster.tsx`, `useToast.ts`, CSS module)
- **Rewritten:** `src/features/auth/authApi.ts`, `src/features/notes/notesStore.ts` (shrinks to mapper + random pickers), `src/features/notes/useNotes.ts`, `src/features/settings/useSettings.ts`
- **Modified:** `vite.config.ts`, `src/App.tsx` (ToastProvider wrapper), `src/pages/DashboardPage.tsx`, `src/features/auth/AuthForm.tsx`, `src/features/settings/settingsStore.ts`
- **Deleted behavior:** all localStorage persistence, seed notes
