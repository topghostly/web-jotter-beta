import app from "./app.js";
import config from "./config/index.js";
import { connectDB } from "./config/db.js";

const PORT = config.port;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();
