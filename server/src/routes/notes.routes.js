import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middlewares/auth.js";
import { createNote, updateNote, deleteNote } from "../controllers/notes.controller.js";

const router = Router();

router.post("/notes", requireAuth, asyncHandler(createNote));
router.patch("/notes/:id", requireAuth, asyncHandler(updateNote));
router.delete("/notes/:id", requireAuth, asyncHandler(deleteNote));

export default router;
