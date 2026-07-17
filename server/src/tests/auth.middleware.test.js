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
