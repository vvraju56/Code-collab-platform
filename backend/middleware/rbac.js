const Project = require("../models/Project");

function getRoleForProject(project, userId) {
  if (!project || !userId) return null;
  if (project.owner?.toString?.() === userId.toString()) return "admin";
  const c = project.collaborators?.find(
    (x) => x.user?.toString?.() === userId.toString(),
  );
  return c?.role ?? null;
}

async function loadProjectWithRole(projectId, userId) {
  const project = await Project.findById(projectId)
    .populate("owner", "username email cursorColor")
    .populate("collaborators.user", "username email cursorColor");
  if (!project) return { project: null, role: null };

  const role = getRoleForProject(project, userId);
  const isPublic = Boolean(project.isPublic);
  const canRead = isPublic || role !== null;
  return { project, role, canRead };
}

function requireProjectRole(minRole) {
  const order = { viewer: 1, editor: 2, admin: 3 };
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id || req.body.projectId;
      if (!projectId) return res.status(400).json({ error: "Missing projectId" });

      const { project, role, canRead } = await loadProjectWithRole(projectId, req.user._id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      if (!canRead) return res.status(403).json({ error: "Access denied" });

      req.project = project;
      req.projectRole = role; // null for public-read users

      if (minRole) {
        const have = role ? order[role] : 0;
        if (have < order[minRole]) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }
      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  };
}

module.exports = { getRoleForProject, loadProjectWithRole, requireProjectRole };

