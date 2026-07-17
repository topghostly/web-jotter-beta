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
