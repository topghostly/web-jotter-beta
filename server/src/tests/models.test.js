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
