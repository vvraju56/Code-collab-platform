const mongoose = require("mongoose");

const versionSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true
  },
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "File",
    required: true
  },
  commitMessage: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  commitHash: {
    type: String,
    required: true,
    unique: true
  },
  parentHash: {
    type: String,
    default: null
  },
  diff: {
    type: String,
    default: ""
  },
  linesAdded: { type: Number, default: 0 },
  linesRemoved: { type: Number, default: 0 }
}, { timestamps: true });

versionSchema.index({ project: 1, file: 1, createdAt: -1 });

module.exports = mongoose.model("Version", versionSchema);
