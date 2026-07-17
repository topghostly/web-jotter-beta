# Jotter Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Jotter backend (sliding-JWT-session auth, Users, Notes, Settings) described in `docs/superpowers/specs/2026-07-14-jotter-backend-design.md`, with a real test suite that runs against an in-memory MongoDB.

**Architecture:** Express 5 REST API layered into `models/` (Mongoose schemas), `services/` (auth logic), `middlewares/` (`requireAuth` sliding-session check, error handling), `controllers/` (route handlers), and `routes/` (route wiring). Identity always comes from the session cookie (`req.user.id`), never from a URL param or request body. `Note` holds a one-way reference to `User` (no stored array on `User`), with a compound `{ user: 1, createdAt: -1 }` index so a user's notes come back already sorted newest-first.

**Tech Stack:** Node.js (ESM) v22+, Express 5, Mongoose 9, `bcryptjs` (password hashing), `jsonwebtoken` (session tokens), `cookie-parser`. Testing: Node's built-in `node:test` + `node:assert/strict`, `supertest` (HTTP-level testing against the Express app), `mongodb-memory-server` (in-memory MongoDB — no Docker required to run the suite).

## Global Constraints

- All identity comes from the session (`req.user.id`, set by `requireAuth`) — no `:id` route params for "the current user" anywhere (spec: Auth & Sliding Session).
- Ownership violations on notes return `404`, not `403`, so the endpoint doesn't leak whether a note with that id exists (spec: Ownership checks).
- `passwordHash` is never included in an API response (spec: User model).
- Sliding session: every authenticated request re-signs the JWT and resets the cookie with a renewed expiry; default window is 7 days, defined as a constant in `auth.service.js` (spec: Auth & Sliding Session).
- Cascade delete (`DELETE /me`) is explicit application code in the controller — no Mongoose pre-hook magic (spec: Cascade Delete).
- A default `Settings` doc is created in the same handler as sign up — there is no standalone `POST /settings` (spec: Settings creation timing).
- `Note.user` is the only stored reference between User and Note — `User` has no stored `notes` array (spec: Note relationship).

---

## Task 1: Bootstrap — deps, module fix, error-handling utilities, DB connection, app/server split

**Files:**
- Modify: `package.json`
- Modify: `.env`
- Create: `src/utils/HttpError.js`
- Create: `src/utils/asyncHandler.js`
- Create: `src/middlewares/errorHandler.js`
- Create: `src/config/db.js`
- Create: `src/app.js`
- Modify: `src/server.js`
- Test: `src/tests/errorHandling.test.js`, `src/tests/db.test.js`, `src/tests/app.test.js`

**Interfaces:**
- Produces: `HttpError` (class, `new HttpError(statusCode, message)`, has `.statusCode`), `asyncHandler(fn)` (wraps an async Express handler, forwards rejections to `next`), `errorHandler(err, req, res, next)` (Express error middleware), `connectDB(uri?)` (async, defaults to `config.mongoUri`), `disconnectDB()` (async), default export `app` from `src/app.js` (a configured but not-listening Express app).

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install bcryptjs cookie-parser jsonwebtoken
npm install --save-dev mongodb-memory-server supertest
```
Expected: `package.json` `dependencies` gains `bcryptjs`, `cookie-parser`, `jsonwebtoken`; `devDependencies` (new section) gains `mongodb-memory-server`, `supertest`.

- [ ] **Step 2: Fix `package.json` module type and test script**

`package.json` currently has a typo (`"types": "module"` instead of `"type": "module"`), which makes Node silently reparse every file as ESM with a performance-warning at boot. Fix it, and point `test` at the real suite.

Edit `package.json`: remove the `"types": "module",` line, add `"type": "module",` right after `"main"`, and change the `test` script:
```json
{
  "name": "server",
  "version": "0.1.0",
  "description": "Backend for demo Jotter application",
  "main": "src/server.js",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "dev": "nodemon src/server.js",
    "start": "node src/server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    ...unchanged, plus what npm install added...
  },
  "devDependencies": {
    ...what npm install --save-dev added...
  }
}
```

- [ ] **Step 3: Fix `MONGO_URI` credentials in `.env`**

The `mongodb` docker-compose service has root auth enabled (`MONGO_INITDB_ROOT_USERNAME`/`PASSWORD` in the repo-root `.env`, currently `ayinla` / `jottersecretpassword`), but `server/.env`'s `MONGO_URI` has no credentials in it, so the real app can't authenticate. Fix it:

Old line:
```
MONGO_URI=mongodb://mongodb:27017/jotter
```
New line:
```
MONGO_URI=mongodb://ayinla:jottersecretpassword@mongodb:27017/jotter?authSource=admin
```
(This only affects the real `docker-compose` run of the server — the test suite uses `mongodb-memory-server` and never touches this URI.)

- [ ] **Step 4: Write failing tests for the error-handling utilities**

Create `src/tests/errorHandling.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/HttpError.js";
import { errorHandler } from "../middlewares/errorHandler.js";

function buildTestApp() {
  const app = express();
  app.get(
    "/throws-http-error",
    asyncHandler(async () => {
      throw new HttpError(409, "Conflict happened");
    })
  );
  app.get(
    "/throws-generic-error",
    asyncHandler(async () => {
      throw new Error("Something broke");
    })
  );
  app.use(errorHandler);
  return app;
}

test("asyncHandler forwards a thrown HttpError to errorHandler with its status code", async () => {
  const app = buildTestApp();
  const res = await request(app).get("/throws-http-error");
  assert.equal(res.status, 409);
  assert.equal(res.body.error, "Conflict happened");
});

test("errorHandler defaults unknown errors to 500", async () => {
  const app = buildTestApp();
  const res = await request(app).get("/throws-generic-error");
  assert.equal(res.status, 500);
  assert.equal(res.body.error, "Something broke");
});
```

- [ ] **Step 5: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../utils/asyncHandler.js'` (or similar; none of the three files exist yet).

- [ ] **Step 6: Implement the error-handling utilities**

Create `src/utils/HttpError.js`:
```js
export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}
```

Create `src/utils/asyncHandler.js`:
```js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

Create `src/middlewares/errorHandler.js`:
```js
export function errorHandler(err, req, res, next) {
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate value" });
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: err.message || "Internal server error" });
}
```

- [ ] **Step 7: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (2 tests in `errorHandling.test.js`).

- [ ] **Step 8: Commit**

```bash
git add src/utils/HttpError.js src/utils/asyncHandler.js src/middlewares/errorHandler.js src/tests/errorHandling.test.js
git commit -m "feat: add HttpError, asyncHandler, and errorHandler utilities"
```

- [ ] **Step 9: Write a failing test for the DB connection module**

Create `src/tests/db.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDB } from "../config/db.js";

test("connectDB connects mongoose to the given MongoDB URI", async () => {
  const mongod = await MongoMemoryServer.create();
  try {
    await connectDB(mongod.getUri());
    assert.equal(mongoose.connection.readyState, 1);
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
});
```

- [ ] **Step 10: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../config/db.js'`.

- [ ] **Step 11: Implement the DB connection module**

Create `src/config/db.js`:
```js
import mongoose from "mongoose";
import config from "./index.js";

export async function connectDB(uri = config.mongoUri) {
  await mongoose.connect(uri);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
```

- [ ] **Step 12: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (1 test in `db.test.js`, plus the 2 from Step 7 still passing).

- [ ] **Step 13: Commit**

```bash
git add src/config/db.js src/tests/db.test.js
git commit -m "feat: add connectDB/disconnectDB for the Mongoose connection"
```

- [ ] **Step 14: Write failing tests for the Express app shell**

Create `src/tests/app.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";

test("GET / returns a welcome message", async () => {
  const res = await request(app).get("/");
  assert.equal(res.status, 200);
  assert.equal(res.body.message, "Welcome to Jotter API");
});

test("GET /nonexistent returns 404 JSON", async () => {
  const res = await request(app).get("/nonexistent");
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "Not found");
});
```

- [ ] **Step 15: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../app.js'`.

- [ ] **Step 16: Implement `src/app.js` and slim down `src/server.js`**

Create `src/app.js`:
```js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/", router);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

export default app;
```

Replace the full contents of `src/server.js`:
```js
import app from "./app.js";
import config from "./config/index.js";
import { connectDB } from "./config/db.js";

const PORT = config.port;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();
```

- [ ] **Step 17: Run the test, verify it passes**

Run: `npm test`
Expected: PASS — all tests from Steps 7, 12, and this step's 2 tests (5 total) pass.

- [ ] **Step 18: Commit**

```bash
git add src/app.js src/server.js src/tests/app.test.js package.json package-lock.json .env
git commit -m "feat: bootstrap app/server split, DB connection, and test harness"
```

---

## Task 2: Auth service (password hashing, sliding session tokens)

**Files:**
- Create: `src/services/auth.service.js`
- Test: `src/tests/auth.service.test.js`

**Interfaces:**
- Consumes: `config.jwtSecret` from `src/config/index.js` (already validated at import time — throws if `JWT_SECRET` is unset).
- Produces: `hashPassword(plainPassword)` (async → hash string), `comparePassword(plainPassword, passwordHash)` (async → boolean), `signSessionToken(userId)` (→ JWT string, 7-day expiry), `verifySessionToken(token)` (→ userId string, throws on invalid/expired/tampered token), `SESSION_COOKIE_NAME` (string constant), `SESSION_COOKIE_OPTIONS` (object: `{ httpOnly, secure, sameSite, maxAge }`).

- [ ] **Step 1: Write the failing tests**

Create `src/tests/auth.service.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  comparePassword,
  signSessionToken,
  verifySessionToken,
} from "../services/auth.service.js";

test("hashPassword produces a hash that comparePassword can verify", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.notEqual(hash, "correct horse battery staple");
  assert.equal(await comparePassword("correct horse battery staple", hash), true);
  assert.equal(await comparePassword("wrong password", hash), false);
});

test("signSessionToken/verifySessionToken round-trip the user id", () => {
  const token = signSessionToken("64f1a2b3c4d5e6f7a8b9c0d1");
  const userId = verifySessionToken(token);
  assert.equal(userId, "64f1a2b3c4d5e6f7a8b9c0d1");
});

test("verifySessionToken throws on a tampered token", () => {
  const token = signSessionToken("64f1a2b3c4d5e6f7a8b9c0d1");
  const lastChar = token.at(-1);
  const tampered = token.slice(0, -1) + (lastChar === "a" ? "b" : "a");
  assert.throws(() => verifySessionToken(tampered));
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../services/auth.service.js'`.

- [ ] **Step 3: Implement the auth service**

Create `src/services/auth.service.js`:
```js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/index.js";

const SALT_ROUNDS = 10;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, slides forward on each authenticated request

export const SESSION_COOKIE_NAME = "jotter_session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: SESSION_TTL_SECONDS * 1000,
};

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function verifySessionToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  return payload.sub;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (3 new tests, plus all prior tests still passing).

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.service.js src/tests/auth.service.test.js
git commit -m "feat: add auth service for password hashing and session tokens"
```

---

## Task 3: Mongoose models (User, Note, Settings)

**Files:**
- Create: `src/models/User.js`
- Create: `src/models/Note.js`
- Create: `src/models/Settings.js`
- Create: `src/tests/helpers/testDb.js`
- Test: `src/tests/models.test.js`

**Interfaces:**
- Produces: default-exported Mongoose models `User`, `Note`, `Settings`; named exports `FONT_SIZE_OPTIONS`, `PAPER_CHOICES` from `src/models/Settings.js`; test helpers `startTestDb()`, `stopTestDb()`, `clearTestDb()` from `src/tests/helpers/testDb.js` (used by every subsequent test file that touches the DB).

- [ ] **Step 1: Write the test DB helper (not a test itself — shared infrastructure for this and later tasks)**

Create `src/tests/helpers/testDb.js`:
```js
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod;

export async function startTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function stopTestDb() {
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearTestDb() {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}
```

- [ ] **Step 2: Write the failing tests for the models**

Create `src/tests/models.test.js`:
```js
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import User from "../models/User.js";
import Note from "../models/Note.js";
import Settings, { FONT_SIZE_OPTIONS, PAPER_CHOICES } from "../models/Settings.js";
import { startTestDb, stopTestDb, clearTestDb } from "./helpers/testDb.js";

before(async () => {
  await startTestDb();
  await Promise.all([User.init(), Note.init(), Settings.init()]);
});
after(stopTestDb);
beforeEach(clearTestDb);

test("User requires name, email, and passwordHash, and lowercases email", async () => {
  await assert.rejects(() => new User({}).validate());
  const user = await User.create({
    name: "Ada",
    email: "Ada@Example.com",
    passwordHash: "hashed",
  });
  assert.equal(user.email, "ada@example.com");
});

test("User email must be unique", async () => {
  await User.create({ name: "Ada", email: "ada@example.com", passwordHash: "hashed" });
  await assert.rejects(() =>
    User.create({ name: "Ada Two", email: "ada@example.com", passwordHash: "hashed" })
  );
});

test("Note requires content and user, gets timestamps, and has a { user, createdAt } index", async () => {
  const user = await User.create({ name: "Ada", email: "ada@example.com", passwordHash: "h" });
  await assert.rejects(() => new Note({ user: user._id }).validate());

  const note = await Note.create({ content: "hello", user: user._id });
  assert.ok(note.createdAt);
  assert.ok(note.updatedAt);

  const indexes = await Note.collection.indexes();
  const compound = indexes.find((idx) => idx.key.user === 1 && idx.key.createdAt === -1);
  assert.ok(compound, "expected a { user: 1, createdAt: -1 } index");
});

test("Settings applies defaults and allows only one doc per user", async () => {
  const user = await User.create({ name: "Ada", email: "ada@example.com", passwordHash: "h" });
  const settings = await Settings.create({ user: user._id });
  assert.equal(settings.fontSize, "medium");
  assert.equal(settings.multicolor, true);
  assert.equal(settings.paper, "random");
  assert.equal(settings.theme, "light");

  await assert.rejects(() => Settings.create({ user: user._id }));
});

test("Settings rejects invalid enum values", async () => {
  const user = await User.create({ name: "Ada", email: "ada@example.com", passwordHash: "h" });
  await assert.rejects(() => Settings.create({ user: user._id, fontSize: "huge" }));
});

test("Settings exports its enum option lists", () => {
  assert.deepEqual(FONT_SIZE_OPTIONS, ["small", "medium", "large"]);
  assert.deepEqual(PAPER_CHOICES, ["random", "plain", "ruled", "grid", "dot"]);
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../models/User.js'`.

- [ ] **Step 4: Implement the models**

Create `src/models/User.js`:
```js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
```

Create `src/models/Note.js`:
```js
import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

noteSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Note", noteSchema);
```

Create `src/models/Settings.js`:
```js
import mongoose from "mongoose";

export const FONT_SIZE_OPTIONS = ["small", "medium", "large"];
export const PAPER_CHOICES = ["random", "plain", "ruled", "grid", "dot"];

const settingsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  fontSize: { type: String, enum: FONT_SIZE_OPTIONS, default: "medium" },
  multicolor: { type: Boolean, default: true },
  paper: { type: String, enum: PAPER_CHOICES, default: "random" },
  theme: { type: String, enum: ["light", "dark"], default: "light" },
});

export default mongoose.model("Settings", settingsSchema);
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (6 new tests, plus all prior tests still passing).

- [ ] **Step 6: Commit**

```bash
git add src/models/User.js src/models/Note.js src/models/Settings.js src/tests/helpers/testDb.js src/tests/models.test.js
git commit -m "feat: add User, Note, and Settings Mongoose models"
```

---

## Task 4: `requireAuth` middleware (sliding session)

**Files:**
- Create: `src/middlewares/auth.js`
- Test: `src/tests/auth.middleware.test.js`

**Interfaces:**
- Consumes: `verifySessionToken`, `signSessionToken`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_OPTIONS` from `src/services/auth.service.js`; `HttpError` from `src/utils/HttpError.js`.
- Produces: `requireAuth(req, res, next)` — Express middleware. On success sets `req.user = { id: <string> }` and resets the session cookie with a fresh expiry. On failure calls `next(new HttpError(401, ...))`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/auth.middleware.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { requireAuth } from "../middlewares/auth.js";
import { errorHandler } from "../middlewares/errorHandler.js";
import { signSessionToken, SESSION_COOKIE_NAME } from "../services/auth.service.js";

function buildTestApp() {
  const app = express();
  app.use(cookieParser());
  app.get("/protected", requireAuth, (req, res) => {
    res.json({ userId: req.user.id });
  });
  app.use(errorHandler);
  return app;
}

test("requireAuth rejects requests with no session cookie", async () => {
  const app = buildTestApp();
  const res = await request(app).get("/protected");
  assert.equal(res.status, 401);
});

test("requireAuth rejects an invalid session cookie", async () => {
  const app = buildTestApp();
  const res = await request(app)
    .get("/protected")
    .set("Cookie", `${SESSION_COOKIE_NAME}=not-a-real-token`);
  assert.equal(res.status, 401);
});

test("requireAuth accepts a valid session cookie, attaches req.user, and refreshes the cookie", async () => {
  const app = buildTestApp();
  const token = signSessionToken("64f1a2b3c4d5e6f7a8b9c0d1");
  const res = await request(app)
    .get("/protected")
    .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.userId, "64f1a2b3c4d5e6f7a8b9c0d1");
  assert.ok(
    res.headers["set-cookie"]?.some((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`)),
    "expected a refreshed session cookie to be set"
  );
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../middlewares/auth.js'`.

- [ ] **Step 3: Implement the middleware**

Create `src/middlewares/auth.js`:
```js
import {
  verifySessionToken,
  signSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../services/auth.service.js";
import { HttpError } from "../utils/HttpError.js";

export function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return next(new HttpError(401, "Not authenticated"));
  }

  let userId;
  try {
    userId = verifySessionToken(token);
  } catch {
    return next(new HttpError(401, "Invalid or expired session"));
  }

  req.user = { id: userId };
  const freshToken = signSessionToken(userId);
  res.cookie(SESSION_COOKIE_NAME, freshToken, SESSION_COOKIE_OPTIONS);
  next();
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (3 new tests, plus all prior tests still passing).

- [ ] **Step 5: Commit**

```bash
git add src/middlewares/auth.js src/tests/auth.middleware.test.js
git commit -m "feat: add requireAuth middleware with sliding session refresh"
```

---

## Task 5: Users — sign up and login (`POST /users`, `POST /users/login`)

**Files:**
- Create: `src/controllers/users.controller.js`
- Create: `src/routes/users.routes.js`
- Modify: `src/routes/index.js`
- Test: `src/tests/users.routes.test.js`

**Interfaces:**
- Consumes: `User`, `Settings` models (Task 3); `hashPassword`, `comparePassword`, `signSessionToken`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_OPTIONS` (Task 2); `HttpError` (Task 1); `asyncHandler` (Task 1).
- Produces: `signUp(req, res)`, `login(req, res)` controllers; mounts `POST /users` and `POST /users/login` onto the shared router.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/users.routes.test.js`:
```js
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import Settings from "../models/Settings.js";
import { startTestDb, stopTestDb, clearTestDb } from "./helpers/testDb.js";

before(startTestDb);
after(stopTestDb);
beforeEach(clearTestDb);

test("POST /users creates a user, a default Settings doc, and starts a session", async () => {
  const res = await request(app).post("/users").send({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "s3cret-password",
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, "ada@example.com");
  assert.equal(res.body.user.passwordHash, undefined);
  assert.ok(res.headers["set-cookie"], "expected a session cookie to be set");

  const settings = await Settings.findOne({ user: res.body.user.id });
  assert.ok(settings, "expected a default Settings doc to be created");
  assert.equal(settings.fontSize, "medium");
});

test("POST /users rejects a duplicate email with 409", async () => {
  await request(app).post("/users").send({
    name: "Ada",
    email: "ada@example.com",
    password: "s3cret-password",
  });

  const res = await request(app).post("/users").send({
    name: "Ada Two",
    email: "ada@example.com",
    password: "another-password",
  });

  assert.equal(res.status, 409);
});

test("POST /users/login succeeds with correct credentials and starts a session", async () => {
  await request(app).post("/users").send({
    name: "Ada",
    email: "ada@example.com",
    password: "s3cret-password",
  });

  const res = await request(app).post("/users/login").send({
    email: "ada@example.com",
    password: "s3cret-password",
  });

  assert.equal(res.status, 200);
  assert.ok(res.headers["set-cookie"]);
});

test("POST /users/login rejects the wrong password with 401", async () => {
  await request(app).post("/users").send({
    name: "Ada",
    email: "ada@example.com",
    password: "s3cret-password",
  });

  const res = await request(app).post("/users/login").send({
    email: "ada@example.com",
    password: "wrong-password",
  });

  assert.equal(res.status, 401);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `POST /users` and `POST /users/login` both 404 (routes don't exist yet, so `app`'s catch-all handler answers instead), failing the status-code assertions.

- [ ] **Step 3: Implement the controller and routes**

Create `src/controllers/users.controller.js`:
```js
import User from "../models/User.js";
import Settings from "../models/Settings.js";
import { HttpError } from "../utils/HttpError.js";
import {
  hashPassword,
  comparePassword,
  signSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../services/auth.service.js";

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function startSession(res, userId) {
  const token = signSessionToken(userId.toString());
  res.cookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
}

export async function signUp(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new HttpError(400, "name, email, and password are required");
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new HttpError(409, "Email already in use");
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash });
  await Settings.create({ user: user._id });

  startSession(res, user._id);
  res.status(201).json({ user: toPublicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new HttpError(400, "email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password");
  }

  startSession(res, user._id);
  res.status(200).json({ user: toPublicUser(user) });
}
```

Create `src/routes/users.routes.js`:
```js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signUp, login } from "../controllers/users.controller.js";

const router = Router();

router.post("/users", asyncHandler(signUp));
router.post("/users/login", asyncHandler(login));

export default router;
```

Replace the full contents of `src/routes/index.js`:
```js
import { Router } from "express";
import greetingController from "../controllers/index.js";
import usersRouter from "./users.routes.js";

const router = Router();

router.get("/", greetingController);
router.use(usersRouter);

export default router;
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (4 new tests, plus all prior tests still passing).

- [ ] **Step 5: Commit**

```bash
git add src/controllers/users.controller.js src/routes/users.routes.js src/routes/index.js src/tests/users.routes.test.js
git commit -m "feat: add sign up and login endpoints"
```

---

## Task 6: `GET /me` and `DELETE /me`

**Files:**
- Create: `src/controllers/me.controller.js`
- Create: `src/routes/me.routes.js`
- Modify: `src/routes/index.js`
- Test: `src/tests/me.routes.test.js`

**Interfaces:**
- Consumes: `User`, `Note`, `Settings` models (Task 3); `requireAuth` (Task 4); `SESSION_COOKIE_NAME` (Task 2); `HttpError`, `asyncHandler` (Task 1).
- Produces: `getMe(req, res)`, `deleteMe(req, res)` controllers; mounts `GET /me` and `DELETE /me` (both behind `requireAuth`) onto the shared router.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/me.routes.test.js`:
```js
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import Note from "../models/Note.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";
import { startTestDb, stopTestDb, clearTestDb } from "./helpers/testDb.js";

before(startTestDb);
after(stopTestDb);
beforeEach(clearTestDb);

async function signUpAgent(email = "ada@example.com") {
  const agent = request.agent(app);
  const res = await agent.post("/users").send({
    name: "Ada",
    email,
    password: "s3cret-password",
  });
  return { agent, userId: res.body.user.id };
}

test("GET /me requires authentication", async () => {
  const res = await request(app).get("/me");
  assert.equal(res.status, 401);
});

test("GET /me returns the user, their notes newest-first, and their settings", async () => {
  const { agent, userId } = await signUpAgent();
  await Note.create({ content: "first", user: userId, createdAt: new Date("2026-01-01") });
  await Note.create({ content: "second", user: userId, createdAt: new Date("2026-01-02") });

  const res = await agent.get("/me");
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, "ada@example.com");
  assert.equal(res.body.notes.length, 2);
  assert.equal(res.body.notes[0].content, "second");
  assert.equal(res.body.settings.theme, "light");
});

test("DELETE /me cascades to the user's Notes and Settings", async () => {
  const { agent, userId } = await signUpAgent();
  await Note.create({ content: "note", user: userId });

  const res = await agent.delete("/me");
  assert.equal(res.status, 204);

  assert.equal(await User.findById(userId), null);
  assert.equal(await Note.countDocuments({ user: userId }), 0);
  assert.equal(await Settings.findOne({ user: userId }), null);

  const followUp = await agent.get("/me");
  assert.equal(followUp.status, 401);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `GET /me` and `DELETE /me` 404 (routes don't exist yet).

- [ ] **Step 3: Implement the controller and routes**

Create `src/controllers/me.controller.js`:
```js
import User from "../models/User.js";
import Note from "../models/Note.js";
import Settings from "../models/Settings.js";
import { HttpError } from "../utils/HttpError.js";
import { SESSION_COOKIE_NAME } from "../services/auth.service.js";

export async function getMe(req, res) {
  const [user, notes, settings] = await Promise.all([
    User.findById(req.user.id),
    Note.find({ user: req.user.id }).sort({ createdAt: -1 }),
    Settings.findOne({ user: req.user.id }),
  ]);

  if (!user) {
    res.clearCookie(SESSION_COOKIE_NAME);
    throw new HttpError(401, "Session refers to a user that no longer exists");
  }

  res.json({
    user: { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt },
    notes,
    settings,
  });
}

export async function deleteMe(req, res) {
  await Promise.all([
    Note.deleteMany({ user: req.user.id }),
    Settings.deleteOne({ user: req.user.id }),
  ]);
  await User.findByIdAndDelete(req.user.id);
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).send();
}
```

Create `src/routes/me.routes.js`:
```js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middlewares/auth.js";
import { getMe, deleteMe } from "../controllers/me.controller.js";

const router = Router();

router.get("/me", requireAuth, asyncHandler(getMe));
router.delete("/me", requireAuth, asyncHandler(deleteMe));

export default router;
```

Replace the full contents of `src/routes/index.js`:
```js
import { Router } from "express";
import greetingController from "../controllers/index.js";
import usersRouter from "./users.routes.js";
import meRouter from "./me.routes.js";

const router = Router();

router.get("/", greetingController);
router.use(usersRouter);
router.use(meRouter);

export default router;
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (3 new tests, plus all prior tests still passing).

- [ ] **Step 5: Commit**

```bash
git add src/controllers/me.controller.js src/routes/me.routes.js src/routes/index.js src/tests/me.routes.test.js
git commit -m "feat: add GET /me and DELETE /me with cascade delete"
```

---

## Task 7: Notes — create, update, delete (`POST /notes`, `PATCH /notes/:id`, `DELETE /notes/:id`)

**Files:**
- Create: `src/controllers/notes.controller.js`
- Create: `src/routes/notes.routes.js`
- Modify: `src/routes/index.js`
- Test: `src/tests/notes.routes.test.js`

**Interfaces:**
- Consumes: `Note` model (Task 3); `requireAuth` (Task 4); `HttpError`, `asyncHandler` (Task 1).
- Produces: `createNote(req, res)`, `updateNote(req, res)`, `deleteNote(req, res)` controllers; mounts `POST /notes`, `PATCH /notes/:id`, `DELETE /notes/:id` (all behind `requireAuth`).

- [ ] **Step 1: Write the failing tests**

Create `src/tests/notes.routes.test.js`:
```js
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { startTestDb, stopTestDb, clearTestDb } from "./helpers/testDb.js";

before(startTestDb);
after(stopTestDb);
beforeEach(clearTestDb);

async function signUpAgent(email) {
  const agent = request.agent(app);
  await agent.post("/users").send({ name: "User", email, password: "s3cret-password" });
  return agent;
}

test("POST /notes requires authentication", async () => {
  const res = await request(app).post("/notes").send({ content: "hi" });
  assert.equal(res.status, 401);
});

test("POST /notes creates a note owned by the logged-in user", async () => {
  const agent = await signUpAgent("owner@example.com");
  const res = await agent.post("/notes").send({ content: "my first note" });
  assert.equal(res.status, 201);
  assert.equal(res.body.note.content, "my first note");
});

test("PATCH /notes/:id updates content when the caller owns the note", async () => {
  const agent = await signUpAgent("owner@example.com");
  const created = await agent.post("/notes").send({ content: "original" });

  const res = await agent.patch(`/notes/${created.body.note._id}`).send({ content: "edited" });

  assert.equal(res.status, 200);
  assert.equal(res.body.note.content, "edited");
});

test("PATCH /notes/:id with a malformed id returns 400", async () => {
  const agent = await signUpAgent("owner@example.com");
  const res = await agent.patch("/notes/not-a-valid-id").send({ content: "x" });
  assert.equal(res.status, 400);
});

test("PATCH and DELETE /notes/:id return 404 for a note owned by someone else", async () => {
  const owner = await signUpAgent("owner@example.com");
  const intruder = await signUpAgent("intruder@example.com");
  const created = await owner.post("/notes").send({ content: "private" });
  const noteId = created.body.note._id;

  const patchRes = await intruder.patch(`/notes/${noteId}`).send({ content: "hacked" });
  assert.equal(patchRes.status, 404);

  const deleteRes = await intruder.delete(`/notes/${noteId}`);
  assert.equal(deleteRes.status, 404);
});

test("DELETE /notes/:id removes the note when the caller owns it", async () => {
  const agent = await signUpAgent("owner@example.com");
  const created = await agent.post("/notes").send({ content: "to delete" });

  const res = await agent.delete(`/notes/${created.body.note._id}`);
  assert.equal(res.status, 204);

  const patchAfterDelete = await agent
    .patch(`/notes/${created.body.note._id}`)
    .send({ content: "should 404" });
  assert.equal(patchAfterDelete.status, 404);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `/notes` routes 404 (don't exist yet).

- [ ] **Step 3: Implement the controller and routes**

Create `src/controllers/notes.controller.js`:
```js
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
```

Create `src/routes/notes.routes.js`:
```js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middlewares/auth.js";
import { createNote, updateNote, deleteNote } from "../controllers/notes.controller.js";

const router = Router();

router.post("/notes", requireAuth, asyncHandler(createNote));
router.patch("/notes/:id", requireAuth, asyncHandler(updateNote));
router.delete("/notes/:id", requireAuth, asyncHandler(deleteNote));

export default router;
```

Replace the full contents of `src/routes/index.js`:
```js
import { Router } from "express";
import greetingController from "../controllers/index.js";
import usersRouter from "./users.routes.js";
import meRouter from "./me.routes.js";
import notesRouter from "./notes.routes.js";

const router = Router();

router.get("/", greetingController);
router.use(usersRouter);
router.use(meRouter);
router.use(notesRouter);

export default router;
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (6 new tests, plus all prior tests still passing).

- [ ] **Step 5: Commit**

```bash
git add src/controllers/notes.controller.js src/routes/notes.routes.js src/routes/index.js src/tests/notes.routes.test.js
git commit -m "feat: add create, update, and delete note endpoints with ownership checks"
```

---

## Task 8: Settings — update (`PATCH /settings`)

**Files:**
- Create: `src/controllers/settings.controller.js`
- Create: `src/routes/settings.routes.js`
- Modify: `src/routes/index.js`
- Test: `src/tests/settings.routes.test.js`

**Interfaces:**
- Consumes: `Settings` model (Task 3); `requireAuth` (Task 4); `HttpError`, `asyncHandler` (Task 1).
- Produces: `updateSettings(req, res)` controller; mounts `PATCH /settings` (behind `requireAuth`).

- [ ] **Step 1: Write the failing tests**

Create `src/tests/settings.routes.test.js`:
```js
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { startTestDb, stopTestDb, clearTestDb } from "./helpers/testDb.js";

before(startTestDb);
after(stopTestDb);
beforeEach(clearTestDb);

async function signUpAgent(email = "ada@example.com") {
  const agent = request.agent(app);
  await agent.post("/users").send({ name: "Ada", email, password: "s3cret-password" });
  return agent;
}

test("PATCH /settings requires authentication", async () => {
  const res = await request(app).patch("/settings").send({ theme: "dark" });
  assert.equal(res.status, 401);
});

test("PATCH /settings updates the caller's preferences", async () => {
  const agent = await signUpAgent();
  const res = await agent.patch("/settings").send({ theme: "dark", fontSize: "large" });
  assert.equal(res.status, 200);
  assert.equal(res.body.settings.theme, "dark");
  assert.equal(res.body.settings.fontSize, "large");
  assert.equal(res.body.settings.multicolor, true);
});

test("PATCH /settings rejects an invalid enum value", async () => {
  const agent = await signUpAgent();
  const res = await agent.patch("/settings").send({ paper: "invalid-choice" });
  assert.equal(res.status, 400);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm test`
Expected: FAIL — `PATCH /settings` 404 (doesn't exist yet).

- [ ] **Step 3: Implement the controller and routes**

Create `src/controllers/settings.controller.js`:
```js
import Settings from "../models/Settings.js";
import { HttpError } from "../utils/HttpError.js";

const UPDATABLE_FIELDS = ["fontSize", "multicolor", "paper", "theme"];

export async function updateSettings(req, res) {
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const settings = await Settings.findOneAndUpdate(
    { user: req.user.id },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!settings) {
    throw new HttpError(404, "Settings not found");
  }

  res.json({ settings });
}
```

Create `src/routes/settings.routes.js`:
```js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middlewares/auth.js";
import { updateSettings } from "../controllers/settings.controller.js";

const router = Router();

router.patch("/settings", requireAuth, asyncHandler(updateSettings));

export default router;
```

Replace the full contents of `src/routes/index.js`:
```js
import { Router } from "express";
import greetingController from "../controllers/index.js";
import usersRouter from "./users.routes.js";
import meRouter from "./me.routes.js";
import notesRouter from "./notes.routes.js";
import settingsRouter from "./settings.routes.js";

const router = Router();

router.get("/", greetingController);
router.use(usersRouter);
router.use(meRouter);
router.use(notesRouter);
router.use(settingsRouter);

export default router;
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test`
Expected: PASS (3 new tests, plus all prior tests still passing).

- [ ] **Step 5: Commit**

```bash
git add src/controllers/settings.controller.js src/routes/settings.routes.js src/routes/index.js src/tests/settings.routes.test.js
git commit -m "feat: add PATCH /settings endpoint"
```

---

## Task 9: End-to-end smoke test

**Files:**
- Test: `src/tests/e2e.test.js`

**Interfaces:**
- Consumes: the full `app` (Task 1) and every endpoint built in Tasks 5–8. No new production code — this task is a capstone integration test proving the whole user journey works together.

- [ ] **Step 1: Write the end-to-end test**

Create `src/tests/e2e.test.js`:
```js
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { startTestDb, stopTestDb, clearTestDb } from "./helpers/testDb.js";

before(startTestDb);
after(stopTestDb);
beforeEach(clearTestDb);

test("full user journey: sign up, read, write, update, delete a note, delete account", async () => {
  const agent = request.agent(app);

  const signUpRes = await agent.post("/users").send({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "s3cret-password",
  });
  assert.equal(signUpRes.status, 201);

  const initialMe = await agent.get("/me");
  assert.equal(initialMe.status, 200);
  assert.deepEqual(initialMe.body.notes, []);
  assert.equal(initialMe.body.settings.fontSize, "medium");

  const createRes = await agent.post("/notes").send({ content: "remember the milk" });
  assert.equal(createRes.status, 201);
  const noteId = createRes.body.note._id;

  const patchRes = await agent.patch(`/notes/${noteId}`).send({ content: "remember the eggs" });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.note.content, "remember the eggs");

  const settingsRes = await agent.patch("/settings").send({ theme: "dark" });
  assert.equal(settingsRes.status, 200);

  const meAfterWrites = await agent.get("/me");
  assert.equal(meAfterWrites.body.notes.length, 1);
  assert.equal(meAfterWrites.body.settings.theme, "dark");

  const deleteNoteRes = await agent.delete(`/notes/${noteId}`);
  assert.equal(deleteNoteRes.status, 204);

  const meAfterDeleteNote = await agent.get("/me");
  assert.deepEqual(meAfterDeleteNote.body.notes, []);

  const deleteMeRes = await agent.delete("/me");
  assert.equal(deleteMeRes.status, 204);

  const meAfterDeleteAccount = await agent.get("/me");
  assert.equal(meAfterDeleteAccount.status, 401);

  const loginAfterDelete = await request(app).post("/users/login").send({
    email: "ada@example.com",
    password: "s3cret-password",
  });
  assert.equal(loginAfterDelete.status, 401);
});
```

- [ ] **Step 2: Run the test, verify it passes**

Run: `npm test`
Expected: PASS — this test plus every test from Tasks 1–8 all pass (full suite green).

- [ ] **Step 3: Commit**

```bash
git add src/tests/e2e.test.js
git commit -m "test: add end-to-end user journey smoke test"
```

---

## Not covered by this plan (see spec's "Out of scope")

Password reset/email verification, admin or multi-user note sharing, pagination/sorting options beyond newest-first, rate limiting on login/sign up, and fixing the Dockerfile's Node version drift (repo pins `node:22-alpine`, this plan was developed against a locally installed Node v24) or verifying the real `docker-compose` stack end-to-end (this plan's tests run against an in-memory MongoDB; the `docker-compose`/root-auth `MONGO_URI` fix in Task 1 is applied but only verifiable by actually running `docker-compose up`).
