import User from "../models/User.js";
import Note from "../models/Note.js";
import Settings from "../models/Settings.js";
import { HttpError } from "../utils/HttpError.js";
import { SESSION_COOKIE_NAME } from "../services/auth.service.js";

export async function getMe(req, res) {
  console.log(req);
  const [user, notes, settings] = await Promise.all([
    User.findById(req.user.id),
    Note.find({ user: req.user.id }).sort({ createdAt: -1 }),
    Settings.findOne({ user: req.user.id }),
  ]);

  if (!user) {
    res.clearCookie(SESSION_COOKIE_NAME);
    throw new HttpError(401, "Session refers to a user that no longer exists");
  }

  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    notes,
    settings,
  });
}

export async function deleteMe(req, res) {
  await Promise.all([
    Note.deleteMany({ user: req.user.id }),
    Settings.deleteOne({ user: req.user.id }),
  ]);
  await User.findByIdAndDelete(req.user.id);
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).send("User deleted successfully");
}
