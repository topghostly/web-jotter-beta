import "dotenv/config";

// Environment Variables
const config = {
  port: process.env.PORT,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
};

// Validate Environment Variables
if (!config.port) {
  throw new Error("PORT is not defined");
}

if (!config.mongoUri) {
  throw new Error("MONGO_URI is not defined");
}

if (!config.jwtSecret) {
  throw new Error("JWT_SECRET is not defined");
}

export default config;
