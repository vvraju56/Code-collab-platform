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
  joinRequests: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String,
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    requestedAt: { type: Date, default: Date.now }
  }],
  invitations: [{
    email: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String,
    role: { type: String, enum: ["viewer", "editor", "admin"], default: "editor" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    invitedAt: { type: Date, default: Date.now }
  }],
  notifications: [{
    type: { type: String, enum: ["invitation", "join_request", "invitation_accepted", "invitation_rejected"] },
    message: String,
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fromUsername: String,
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    projectName: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  language: {
    type: String,
    default: "java",
    enum: ["java", "python", "react", "c", "csharp", "javascript"]
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

// Index for search - We use language_override: "none" because we have a field named "language"
// that contains programming languages, which MongoDB text search doesn't support as natural languages.
projectSchema.index({ name: "text", description: "text" }, { language_override: "none" });

module.exports = mongoose.model("Project", projectSchema);
