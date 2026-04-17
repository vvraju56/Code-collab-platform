const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  path: {
    type: String,
    required: true  // e.g. "/src/index.js"
  },
  content: {
    type: String,
    default: ""
  },
  language: {
    type: String,
    default: "javascript"
  },
  size: {
    type: Number,
    default: 0
  },
  isDirectory: {
    type: Boolean,
    default: false
  },
  parentPath: {
    type: String,
    default: "/"
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  lastEditedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

fileSchema.index({ project: 1, path: 1 }, { unique: true });

module.exports = mongoose.model("File", fileSchema);
