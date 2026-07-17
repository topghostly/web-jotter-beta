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
