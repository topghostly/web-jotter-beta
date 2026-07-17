import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDB } from "../config/db.js";

test("connectDB connects mongoose to the given MongoDB URI", async () => {
  const mongod = await MongoMemoryServer.create();
  try {
    await connectDB(mongod.getUri());
    assert.equal(mongoose.connection.readyState, 1);
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
});
