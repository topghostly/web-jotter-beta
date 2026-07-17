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
