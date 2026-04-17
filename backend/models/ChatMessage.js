const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ["text", "system", "code"],
    default: "text"
  },
  codeSnippet: {
    language: String,
    content: String
  }
}, { timestamps: true });

chatMessageSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
