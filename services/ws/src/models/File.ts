import mongoose, { Schema } from "mongoose";

const fileSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true, trim: true },
    path: { type: String, required: true },
    content: { type: String, default: "" },
    language: { type: String, default: "javascript" },
    size: { type: Number, default: 0 },
    isDirectory: { type: Boolean, default: false },
    parentPath: { type: String, default: "/" },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastEditedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

fileSchema.index({ project: 1, path: 1 }, { unique: true });

export const FileModel =
  mongoose.models.File ?? mongoose.model("File", fileSchema);

