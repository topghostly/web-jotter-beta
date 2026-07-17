# Jotter Backend Design

Date: 2026-07-14

## Purpose

A simple Express + Mongoose backend for the Jotter app, backed by a local
MongoDB running in Docker (already wired up via the repo's
`docker-compose.yml`, service name `mongodb`). Three collections: Users,
Notes, Settings. Users sign up / log in, get a sliding JWT session, and can
create/edit/delete their own notes and preferences.

## Data Models

### User
```
_id: ObjectId
name: string, required
email: string, required, unique, lowercase
passwordHash: string, required   // bcrypt hash, never included in API responses
createdAt: Date
```
No stored `notes` array on User. See "Note relationship" below.

### Note
```
_id: ObjectId
content: string, required
user: ObjectId, ref: "User", required, indexed
createdAt: Date
updatedAt: Date
```
Compound index `{ user: 1, createdAt: -1 }` so `Note.find({ user: userId })`
in the `GET /me` flow can return notes already sorted newest-first straight
from the index, without an in-memory sort.

### Settings
```
_id: ObjectId
user: ObjectId, ref: "User", required, unique   // one Settings doc per user
fontSize: enum ["small", "medium", "large"], default "medium"
multicolor: boolean, default true
paper: enum ["random", "plain", "ruled", "grid", "dot"], default "random"
theme: enum ["light", "dark"], default "light"
```

### Note relationship: one-way ref only

The original sketch had both `User.notes` (array of Notes) and `Note.user`
(back-reference), i.e. the relationship stored in both directions. Decided
against this: two-way references drift out of sync in Mongoose (e.g.
deleting a note requires remembering to also pull it out of the user's
array). Instead, `Note.user` is the only stored reference, and "get a
user's notes" is `Note.find({ user: userId })` — this is exactly the
`findMany` step already planned for the combined read endpoint.

## Auth & Sliding Session

- Credentials: email + password (bcrypt-hashed). The original schema had
  no credential fields; these were added because sliding JWT sessions need
  something to authenticate against, and because a login endpoint is in
  scope (see below).
- `POST /users` (sign up) and `POST /users/login` both end by issuing a
  JWT and setting it as an **httpOnly, secure, sameSite cookie** (not
  returned in the response body — not readable by client JS).
- A `requireAuth` middleware reads the JWT from the cookie, verifies it,
  attaches `req.user = { id }`, and **re-signs a fresh token with a
  renewed expiry on every authenticated request**, resetting the cookie.
  This is the "sliding" behavior: an active user's session keeps extending;
  an idle user's session expires after the configured window (proposed
  default: 7 days — adjust in `auth.service.js` if a different window is
  wanted).
- Every route except sign up and login requires this middleware. There are
  no `:id` params for "the current user" anywhere in the API — identity
  always comes from the session (`req.user.id`), never from the URL or
  request body. This also means `DELETE` of a user only ever deletes the
  logged-in user's own account (no admin/other-user deletion in this
  design).

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/users` | no | Sign up: create user + default Settings doc, start session |
| POST | `/users/login` | no | Log in with email + password, start session |
| DELETE | `/me` | yes | Delete the logged-in user, cascading to their Notes and Settings |
| GET | `/me` | yes | `Promise.all` of the user doc, `Note.find({ user })` sorted newest-first (via the compound index), and the Settings doc; returned together as `{ user, notes, settings }` |
| POST | `/notes` | yes | Create a note owned by the logged-in user |
| PATCH | `/notes/:id` | yes | Update a note's `content` (must belong to the logged-in user) |
| DELETE | `/notes/:id` | yes | Delete a note (must belong to the logged-in user) |
| PATCH | `/settings` | yes | Update one or more preference fields on the logged-in user's Settings |

### Ownership checks

`PATCH /notes/:id` and `DELETE /notes/:id` load the note first and verify
`note.user.equals(req.user.id)` before mutating. If it doesn't match,
respond `404` (not `403`) so the endpoint doesn't leak whether a note with
that id exists at all.

## Settings creation timing

A default Settings doc (all fields at their defaults) is created
automatically as part of `POST /users` sign up, in the same handler as
user creation. This guarantees `GET /me`'s `Promise.all` never has to
handle a missing Settings doc. There is no standalone `POST /settings`.

## Cascade Delete

`DELETE /me` runs, in order, inside the handler (no Mongoose
pre-hooks/middleware magic — kept explicit and readable):
1. `Note.deleteMany({ user: req.user.id })`
2. `Settings.deleteOne({ user: req.user.id })`
3. `User.findByIdAndDelete(req.user.id)`
4. Clear the session cookie

## Error Handling & Validation

- Mongoose schema validation (`required`, `enum`, `unique`) covers most
  input validation.
- Controllers add thin manual checks for things Mongoose can't express:
  "email already in use" → `409`, "wrong password" → `401`, "note not
  owned by you" → `404` (see Ownership checks above).
- A single `errorHandler` middleware converts thrown errors into
  `{ error: message }` JSON with an appropriate status code.
- Controllers are wrapped with an `asyncHandler` utility so thrown/rejected
  errors in `async` route handlers are forwarded to `errorHandler` instead
  of crashing the process.

## Project Structure

Fits the existing skeleton (`src/{config,controllers,middlewares,routes,
services,utils}` already present, currently placeholders):

```
src/
  models/       User.js, Note.js, Settings.js
  controllers/  users.controller.js, notes.controller.js, settings.controller.js
  routes/       users.routes.js, notes.routes.js, settings.routes.js, index.js (mounts all)
  middlewares/  auth.js (requireAuth + sliding refresh), errorHandler.js
  services/     auth.service.js (password hash/compare, JWT sign/verify)
  utils/        asyncHandler.js
```

## Known setup issue (not part of this design, flagged for the implementation pass)

`docker-compose.yml`'s `mongodb` service sets
`MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD`, which enables
auth on the Mongo container. `server/.env`'s `MONGO_URI` is currently
`mongodb://mongodb:27017/jotter`, with no credentials — this connection
will fail once auth is enforced. The implementation pass needs to either
add the root credentials to `MONGO_URI` (e.g.
`mongodb://ayinla:jottersecretpassword@mongodb:27017/jotter?authSource=admin`)
or create a dedicated non-root DB user for the app to connect as.

## Out of scope for this pass

- Password reset / email verification
- Admin or multi-user note sharing
- Pagination/sorting on `GET /me`'s notes list
- Rate limiting on login/sign up
