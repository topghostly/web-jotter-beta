import mongoose from "mongoose";

export const FONT_SIZE_OPTIONS = ["small", "medium", "large"];
export const PAPER_CHOICES = ["random", "plain", "ruled", "grid", "dot"];

const settingsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  fontSize: { type: String, enum: FONT_SIZE_OPTIONS, default: "medium" },
  multicolor: { type: Boolean, default: true },
  paper: { type: String, enum: PAPER_CHOICES, default: "random" },
  theme: { type: String, enum: ["light", "dark"], default: "light" },
});

export default mongoose.model("Settings", settingsSchema);
