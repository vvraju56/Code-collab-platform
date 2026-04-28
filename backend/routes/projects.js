const express = require("express");
const Project = require("../models/Project");
const File = require("../models/File");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/projects — list all accessible projects
router.get("/", async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { "collaborators.user": req.user._id },
        { isPublic: true }
      ]
    })
      .populate("owner", "username email cursorColor")
      .populate("collaborators.user", "username email cursorColor")
      .sort({ lastActivity: -1 });

    res.json(projects);
  } catch (err) {
    console.error("🔥 Error creating project:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects — create project + default files
router.post("/", async (req, res) => {
  try {
    const { name, description, language, isPublic } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    const project = await Project.create({
      name,
      description,
      language: language || "javascript",
      isPublic: isPublic || false,
      owner: req.user._id
    });

    // Create default entry file
    const defaultContent = getDefaultContent(language || "javascript", name);
    await File.create({
      project: project._id,
      name: getDefaultFileName(language || "javascript"),
      path: "/" + getDefaultFileName(language || "javascript"),
      content: defaultContent,
      language: language || "javascript",
      parentPath: "/",
      lastEditedBy: req.user._id
    });

    const populated = await Project.findById(project._id)
      .populate("owner", "username email cursorColor");

    res.status(201).json(populated);
  } catch (err) {
    console.error("🚀 Error in POST /api/projects:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("owner", "username email cursorColor")
      .populate("collaborators.user", "username email cursorColor");

    if (!project) return res.status(404).json({ error: "Project not found" });

    const hasAccess = project.isPublic ||
      project.owner._id.toString() === req.user._id.toString() ||
      project.collaborators.some(c => c.user._id.toString() === req.user._id.toString());

    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id — update project
router.put("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Only owner can update project" });

    const { name, description, language, isPublic } = req.body;
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (language) project.language = language;
    if (isPublic !== undefined) project.isPublic = isPublic;

    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Only owner can delete project" });

    await File.deleteMany({ project: project._id });
    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/collaborators — invite collaborator by username
router.post("/:id/collaborators", async (req, res) => {
  try {
    const { username, role } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Only owner can invite collaborators" });

    const invitee = await User.findOne({ username });
    if (!invitee) return res.status(404).json({ error: "User not found" });

    const alreadyIn = project.collaborators.some(c => c.user.toString() === invitee._id.toString());
    if (alreadyIn) return res.status(400).json({ error: "User is already a collaborator" });

    project.collaborators.push({ user: invitee._id, role: role || "editor" });
    await project.save();

    const populated = await Project.findById(project._id)
      .populate("owner", "username email cursorColor")
      .populate("collaborators.user", "username email cursorColor");

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/collaborators/:userId
router.delete("/:id/collaborators/:userId", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ error: "Only owner can remove collaborators" });

    project.collaborators = project.collaborators.filter(
      c => c.user.toString() !== req.params.userId
    );
    await project.save();
    res.json({ message: "Collaborator removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDefaultFileName(language) {
  const map = {
    javascript: "index.js", typescript: "index.ts", python: "main.py",
    java: "Main.java", cpp: "main.cpp", c: "main.c", go: "main.go",
    rust: "main.rs", php: "index.php", ruby: "main.rb",
    html: "index.html", css: "styles.css", markdown: "README.md"
  };
  return map[language] || "index.js";
}

function getDefaultContent(language, projectName) {
  const map = {
    javascript: `// ${projectName}\n// Real-Time Collaboration — CodeBloc Platform\n\nconsole.log("Hello from ${projectName}!");\n\nfunction main() {\n  // Your code here\n}\n\nmain();\n`,
    typescript: `// ${projectName}\n\ninterface Project {\n  name: string;\n  language: string;\n}\n\nconst project: Project = {\n  name: "${projectName}",\n  language: "typescript"\n};\n\nconsole.log(project);\n`,
    python: `# ${projectName}\n# Real-Time Collaboration — CodeBloc Platform\n\ndef main():\n    print("Hello from ${projectName}!")\n\nif __name__ == "__main__":\n    main()\n`,
    java: `// ${projectName}\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from ${projectName}!");\n    }\n}\n`,
    cpp: `// ${projectName}\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from ${projectName}!" << std::endl;\n    return 0;\n}\n`,
    html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>${projectName}</title>\n</head>\n<body>\n  <h1>${projectName}</h1>\n  <p>Built with CodeBloc.</p>\n</body>\n</html>\n`,
    markdown: `# ${projectName}\n\nA project built on CodeBloc real-time collaboration platform.\n\n## Getting Started\n\nEdit this file to document your project.\n`
  };
  return map[language] || `// ${projectName}\n`;
}

module.exports = router;
