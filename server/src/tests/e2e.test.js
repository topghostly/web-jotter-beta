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
