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
