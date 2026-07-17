import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middlewares/auth.js";
import { updateSettings } from "../controllers/settings.controller.js";

const router = Router();

router.patch("/settings", requireAuth, asyncHandler(updateSettings));

export default router;
