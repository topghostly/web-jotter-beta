import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signUp, login, logout } from "../controllers/users.controller.js";

const router = Router();

router.post("/users", asyncHandler(signUp));
router.post("/users/login", asyncHandler(login));
router.post("/users/logout", asyncHandler(logout));

export default router;
