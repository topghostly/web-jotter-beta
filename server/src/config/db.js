import mongoose from "mongoose";
import config from "./index.js";

export async function connectDB(uri = config.mongoUri) {
  try {
    await mongoose.connect(uri);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
