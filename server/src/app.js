import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/", router);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

export default app;
