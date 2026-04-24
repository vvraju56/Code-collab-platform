const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: "",
    maxlength: 500
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  collaborators: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["viewer", "editor", "admin"], default: "editor" },
    joinedAt: { type: Date, default: Date.now }
  }],
  language: {
    type: String,
    default: "javascript",
    enum: ["javascript","typescript","python","java","cpp","c","go","rust","php","ruby","html","css","json","markdown","bash"]
  },
  isPublic: { type: Boolean, default: false },
  stars: { type: Number, default: 0 },
  forks: { type: Number, default: 0 },
  totalCommits: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now },
  github: {
    owner: { type: String, default: "" },
    repo: { type: String, default: "" },
    branch: { type: String, default: "main" },
    linkedAt: { type: Date }
  }
}, { timestamps: true });

// Index for search
projectSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Project", projectSchema);
