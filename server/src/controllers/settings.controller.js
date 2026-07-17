import Settings from "../models/Settings.js";
import { HttpError } from "../utils/HttpError.js";

const UPDATABLE_FIELDS = ["fontSize", "multicolor", "paper", "theme"];

export async function updateSettings(req, res) {
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const settings = await Settings.findOneAndUpdate(
    { user: req.user.id },
    { $set: updates },
    { returnDocument: "after", runValidators: true }
  );

  if (!settings) {
    throw new HttpError(404, "Settings not found");
  }

  res.json({ settings });
}
