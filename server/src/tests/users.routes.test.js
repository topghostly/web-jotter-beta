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
