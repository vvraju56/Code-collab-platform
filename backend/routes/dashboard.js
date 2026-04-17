const express = require("express");
const Project = require("../models/Project");
const User = require("../models/User");
const Version = require("../models/Version");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
  try {
    const [totalProjects, totalUsers, totalCommits] = await Promise.all([
      Project.countDocuments({
        $or: [
          { owner: req.user._id },
          { "collaborators.user": req.user._id }
        ]
      }),
      User.countDocuments(),
      Version.countDocuments({ author: req.user._id })
    ]);

    res.json({ totalProjects, totalUsers, totalCommits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
