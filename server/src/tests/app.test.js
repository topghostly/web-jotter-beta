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
