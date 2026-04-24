import mongoose, { Schema } from "mongoose";

const projectSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    collaborators: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["viewer", "editor", "admin"], default: "editor" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const ProjectModel =
  mongoose.models.Project ?? mongoose.model("Project", projectSchema);

