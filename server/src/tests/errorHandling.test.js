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
    }),
  );
  app.get(
    "/throws-generic-error",
    asyncHandler(async () => {
      throw new Error("Something broke");
    }),
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
