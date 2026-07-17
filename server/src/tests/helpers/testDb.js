import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod;

export async function startTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function stopTestDb() {
  await mongoose.disconnect();
  await mongod.stop();
}

export async function clearTestDb() {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}
