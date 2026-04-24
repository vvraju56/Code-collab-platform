const express = require("express");
const File = require("../models/File");
const Project = require("../models/Project");
const { authMiddleware } = require("../middleware/auth");
const { getRoleForProject } = require("../middleware/rbac");

const router = express.Router();
router.use(authMiddleware);

// Helper: check project access
async function checkAccess(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) return null;
  const role = getRoleForProject(project, userId);
  const hasAccess = Boolean(project.isPublic) || role !== null;
  return hasAccess ? { project, role } : null;
}

// GET /api/files/project/:projectId — list all files
router.get("/project/:projectId", async (req, res) => {
  try {
    const access = await checkAccess(req.params.projectId, req.user._id);
    if (!access) return res.status(403).json({ error: "Access denied" });

    const files = await File.find({ project: req.params.projectId })
      .populate("lastEditedBy", "username cursorColor")
      .sort({ path: 1 });

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/:id — single file with content
router.get("/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
      .populate("lastEditedBy", "username cursorColor");
    if (!file) return res.status(404).json({ error: "File not found" });

    const access = await checkAccess(file.project, req.user._id);
    if (!access) return res.status(403).json({ error: "Access denied" });

    res.json(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files — create file
router.post("/", async (req, res) => {
  try {
    const { projectId, name, path, language, isDirectory, parentPath } = req.body;

    const access = await checkAccess(projectId, req.user._id);
    if (!access) return res.status(403).json({ error: "Access denied" });
    if (!access.role || (access.role !== "editor" && access.role !== "admin")) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const exists = await File.findOne({ project: projectId, path });
    if (exists) return res.status(400).json({ error: "File already exists at this path" });

    const file = await File.create({
      project: projectId,
      name,
      path,
      language: language || "javascript",
      isDirectory: isDirectory || false,
      parentPath: parentPath || "/",
      content: "",
      lastEditedBy: req.user._id
    });

    await Project.findByIdAndUpdate(projectId, { lastActivity: new Date() });

    res.status(201).json(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/files/:id — save content
router.put("/:id", async (req, res) => {
  try {
    const { content, name } = req.body;
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const access = await checkAccess(file.project, req.user._id);
    if (!access) return res.status(403).json({ error: "Access denied" });
    if (!access.role || (access.role !== "editor" && access.role !== "admin")) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    if (content !== undefined) {
      file.content = content;
      file.size = Buffer.byteLength(content, "utf8");
    }
    if (name) file.name = name;
    file.lastEditedBy = req.user._id;
    file.lastEditedAt = new Date();

    await file.save();
    await Project.findByIdAndUpdate(file.project, { lastActivity: new Date() });

    res.json(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/files/:id
router.delete("/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const access = await checkAccess(file.project, req.user._id);
    if (!access) return res.status(403).json({ error: "Access denied" });
    if (!access.role || (access.role !== "editor" && access.role !== "admin")) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    if (file.isDirectory) {
      await File.deleteMany({ project: file.project, path: new RegExp(`^${file.path}/`) });
    }
    await File.findByIdAndDelete(req.params.id);

    res.json({ message: "File deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
