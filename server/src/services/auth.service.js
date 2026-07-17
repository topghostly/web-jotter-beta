import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/index.js";

const SALT_ROUNDS = 10;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, slides forward on each authenticated request

export const SESSION_COOKIE_NAME = "jotter_session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: SESSION_TTL_SECONDS * 1000,
};

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function verifySessionToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  return payload.sub;
}
