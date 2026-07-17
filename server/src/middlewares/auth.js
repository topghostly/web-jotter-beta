import {
  verifySessionToken,
  signSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../services/auth.service.js";
import { HttpError } from "../utils/HttpError.js";

export function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return next(new HttpError(401, "Not authenticated"));
  }

  let userId;
  try {
    userId = verifySessionToken(token);
  } catch {
    return next(new HttpError(401, "Invalid or expired session"));
  }

  req.user = { id: userId };
  const freshToken = signSessionToken(userId);
  res.cookie(SESSION_COOKIE_NAME, freshToken, SESSION_COOKIE_OPTIONS);
  next();
}
