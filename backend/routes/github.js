const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const simpleGit = require("simple-git");

const { authMiddleware } = require("../middleware/auth");
const Project = require("../models/Project");
const File = require("../models/File");
const { encryptString, decryptString } = require("../utils/crypto");
const { getRoleForProject } = require("../middleware/rbac");

const router = express.Router();
router.use(authMiddleware);

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function repoDir(projectId) {
  return path.join(process.cwd(), "data", "repos", `${projectId}`);
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function getGithubToken(user) {
  const enc = user.github?.encryptedAccessToken;
  if (!enc) return null;
  return decryptString(enc);
}

// GET /api/github/login
router.get("/login", async (req, res) => {
  try {
    const clientId = mustEnv("GITHUB_CLIENT_ID");
    const redirectUri = mustEnv("GITHUB_REDIRECT_URI");
    const state = Buffer.from(`${req.user._id}:${Date.now()}`).toString("base64url");
    const scope = encodeURIComponent("repo read:user user:email");
    const url =
      `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scope}&state=${encodeURIComponent(state)}`;
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/github/callback
router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: "Missing code" });

    const clientId = mustEnv("GITHUB_CLIENT_ID");
    const clientSecret = mustEnv("GITHUB_CLIENT_SECRET");

    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok || tokenJson.error) {
      return res.status(400).json({ error: tokenJson.error_description || "OAuth failed" });
    }

    const accessToken = tokenJson.access_token;
    const meResp = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "collab-platform" },
    });
    const me = await meResp.json();

    req.user.github = {
      encryptedAccessToken: encryptString(accessToken),
      keyVersion: 1,
      username: me?.login || "",
      createdAt: new Date(),
    };
    await req.user.save();

    res.json({ ok: true, githubUsername: req.user.github.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/github/link
router.post("/link", async (req, res) => {
  try {
    const { projectId, owner, repo, branch } = req.body;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (getRoleForProject(project, req.user._id) !== "admin") return res.status(403).json({ error: "Only admin can link repos" });

    project.github = { owner, repo, branch: branch || "main", linkedAt: new Date() };
    await project.save();
    res.json({ ok: true, github: project.github });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/github/pull
router.post("/pull", async (req, res) => {
  try {
    const { projectId } = req.body;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const dir = repoDir(project._id.toString());
    await ensureDir(dir);
    const git = simpleGit(dir);
    const token = await getGithubToken(req.user);
    if (!token) return res.status(400).json({ error: "GitHub not connected" });

    const remote = `https://x-access-token:${token}@github.com/${project.github.owner}/${project.github.repo}.git`;
    
    // Check if repo exists, clone if not, else pull
    try {
      await fs.access(path.join(dir, ".git"));
      await git.pull(remote, project.github.branch || "main");
    } catch {
      await git.clone(remote, dir);
    }
    
    await ingestWorkingTreeToMongo(project._id, dir);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/github/commit-push
router.post("/commit-push", async (req, res) => {
  try {
    const { projectId, message } = req.body;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const dir = repoDir(project._id.toString());
    const git = simpleGit(dir);
    const token = await getGithubToken(req.user);
    if (!token) return res.status(400).json({ error: "GitHub not connected" });

    await materializeWorkingTree(project._id, dir);
    const remote = `https://x-access-token:${token}@github.com/${project.github.owner}/${project.github.repo}.git`;

    await git
      .add("./*")
      .commit(message || "Update from CollabPlatform")
      .push(remote, project.github.branch || "main");

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function materializeWorkingTree(projectId, dir) {
  await ensureDir(dir);
  const files = await File.find({ project: projectId, isDirectory: false }).lean();
  for (const f of files) {
    const rel = (f.path || "/").replace(/^\//, "");
    if (!rel) continue;
    const abs = path.join(dir, rel);
    await ensureDir(path.dirname(abs));
    await fs.writeFile(abs, f.content || "", "utf8");
  }
}

async function ingestWorkingTreeToMongo(projectId, dir) {
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === ".git") continue;
      const abs = path.join(current, e.name);
      const rel = path.relative(dir, abs).replaceAll("\\", "/");
      if (e.isDirectory()) {
        await walk(abs);
      } else {
        const content = await fs.readFile(abs, "utf8");
        const p = "/" + rel;
        await File.findOneAndUpdate(
          { project: projectId, path: p },
          { project: projectId, name: path.basename(p), path: p, parentPath: "/" + path.posix.dirname(rel), content, isDirectory: false, size: Buffer.byteLength(content, "utf8"), lastEditedAt: new Date() },
          { upsert: true }
        );
      }
    }
  }
  await walk(dir);
}

module.exports = router;
