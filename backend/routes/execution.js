const express = require("express");
const { exec } = require("child_process");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const TIMEOUT_MS = 10000; // 10 seconds max

// Language execution configs
const RUNNERS = {
  javascript: { cmd: (code) => `node -e ${JSON.stringify(code)}`, ext: "js" },
  python: { cmd: (code) => `python3 -c ${JSON.stringify(code)}`, ext: "py" },
  bash: { cmd: (code) => `bash -c ${JSON.stringify(code)}`, ext: "sh" }
};

// POST /api/execute
router.post("/", async (req, res) => {
  const { code, language } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ error: "No code provided" });
  }

  const runner = RUNNERS[language];
  if (!runner) {
    return res.json({
      output: "",
      error: `Execution for '${language}' is not supported in sandbox.\nSupported: javascript, python, bash.`,
      executionTime: 0,
      language
    });
  }

  const startTime = Date.now();

  try {
    const command = runner.cmd(code);

    exec(command, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 512 }, (error, stdout, stderr) => {
      const executionTime = Date.now() - startTime;

      if (error && error.killed) {
        return res.json({
          output: stdout || "",
          error: "⏱ Execution timed out (10s limit exceeded)",
          executionTime,
          language
        });
      }

      res.json({
        output: stdout || "",
        error: stderr || (error ? error.message : ""),
        exitCode: error ? error.code : 0,
        executionTime,
        language
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
