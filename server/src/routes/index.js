import { Router } from "express";
import greetingController from "../controllers/index.js";
import usersRouter from "./users.routes.js";
import meRouter from "./me.routes.js";
import notesRouter from "./notes.routes.js";
import settingsRouter from "./settings.routes.js";

const router = Router();

router.get("/", greetingController);
router.use(usersRouter);
router.use(meRouter);
router.use(notesRouter);
router.use(settingsRouter);

export default router;
