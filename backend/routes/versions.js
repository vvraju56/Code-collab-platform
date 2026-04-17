const express = require("express");
const crypto = require("crypto");
const Version = require("../models/Version");
const File = require("../models/File");
const Project = require("../models/Project");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Generate a short commit hash
function generateHash(content, userId, timestamp) {
  return crypto
    .createHash("sha1")
    .update(content + userId + timestamp)
    .digest("hex")
    .substring(0, 8);
}

// Simple line diff
function computeDiff(oldContent, newContent) {
  const oldLines = (oldContent || "").split("\n");
  const newLines = (newContent || "").split("\n");
  let added = 0, removed = 0;

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) added++;
    else if (i >= newLines.length) removed++;
    else if (oldLines[i] !== newLines[i]) { added++; removed++; }
  }

  return { linesAdded: added, linesRemoved: removed };
}

// POST /api/versions/commit — commit a file version
router.post("/commit", async (req, res) => {
  try {
    const { fileId, commitMessage } = req.body;

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    // Get last commit for this file
    const lastVersion = await Version.findOne({ file: fileId }).sort({ createdAt: -1 });
    const oldContent = lastVersion ? lastVersion.content : "";
    const { linesAdded, linesRemoved } = computeDiff(oldContent, file.content);

    const hash = generateHash(file.content, req.user._id, Date.now());

    const version = await Version.create({
      project: file.project,
      file: fileId,
      commitMessage: commitMessage || "Update file",
      content: file.content,
      author: req.user._id,
      commitHash: hash,
      parentHash: lastVersion ? lastVersion.commitHash : null,
      linesAdded,
      linesRemoved
    });

    // Increment project commit count
    await Project.findByIdAndUpdate(file.project, {
      $inc: { totalCommits: 1 },
      lastActivity: new Date()
    });

    await version.populate("author", "username email cursorColor");
    res.status(201).json(version);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/versions/file/:fileId — commit log for file
router.get("/file/:fileId", async (req, res) => {
  try {
    const versions = await Version.find({ file: req.params.fileId })
      .populate("author", "username email cursorColor")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/versions/project/:projectId — all commits for project
router.get("/project/:projectId", async (req, res) => {
  try {
    const versions = await Version.find({ project: req.params.projectId })
      .populate("author", "username email cursorColor")
      .populate("file", "name path")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/versions/:id — single version
router.get("/:id", async (req, res) => {
  try {
    const version = await Version.findById(req.params.id)
      .populate("author", "username email cursorColor")
      .populate("file", "name path language");

    if (!version) return res.status(404).json({ error: "Version not found" });
    res.json(version);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/versions/:id/revert — restore file to this version
router.post("/:id/revert", async (req, res) => {
  try {
    const version = await Version.findById(req.params.id).populate("file");
    if (!version) return res.status(404).json({ error: "Version not found" });

    await File.findByIdAndUpdate(version.file._id, {
      content: version.content,
      lastEditedBy: req.user._id,
      lastEditedAt: new Date()
    });

    res.json({ message: "File reverted successfully", content: version.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
