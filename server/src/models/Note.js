import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

noteSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Note", noteSchema);
