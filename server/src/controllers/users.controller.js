import User from "../models/User.js";
import Settings from "../models/Settings.js";
import { HttpError } from "../utils/HttpError.js";
import {
  hashPassword,
  comparePassword,
  signSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../services/auth.service.js";

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function startSession(res, userId) {
  const token = signSessionToken(userId.toString());
  res.cookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
}

export async function signUp(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new HttpError(400, "name, email, and password are required");
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new HttpError(409, "Email already in use");
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash });
  await Settings.create({ user: user._id });

  startSession(res, user._id);
  res.status(201).json({ user: toPublicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new HttpError(400, "email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password");
  }

  startSession(res, user._id);
  res.status(200).json({ user: toPublicUser(user) });
}

export async function logout(req, res) {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).send("User logged out successfully");
}
