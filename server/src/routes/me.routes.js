import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middlewares/auth.js";
import { getMe, deleteMe } from "../controllers/me.controller.js";

const router = Router();

router.get("/me", requireAuth, asyncHandler(getMe));
router.delete("/me", requireAuth, asyncHandler(deleteMe));

export default router;
