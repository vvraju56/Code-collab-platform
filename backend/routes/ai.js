const express = require("express");
const OpenAI = require("openai");
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { authMiddleware } = require("../middleware/auth");
const { encryptString, decryptString } = require("../utils/crypto");
const Project = require("../models/Project");
const File = require("../models/File");

const router = express.Router();
router.use(authMiddleware);

function maskLast4(key) {
  if (!key) return "";
  return key.slice(-4);
}

function getProvider(key) {
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("AIza")) return "gemini";
  return "openai";
}

function getAllKeyEntries(user) {
  const pool = user.aiKeys || [];
  let entries = pool.map(entry => {
    const dec = decryptString(entry.encryptedApiKey);
    return { id: entry._id, key: dec, provider: getProvider(dec) };
  });
  if (user.openai?.encryptedApiKey) {
    const legacyDec = decryptString(user.openai.encryptedApiKey);
    if (!entries.some(e => e.key === legacyDec)) {
      entries.push({ id: "legacy", key: legacyDec, provider: getProvider(legacyDec) });
    }
  }
  return entries.sort(() => Math.random() - 0.5);
}

const SYSTEM_PROMPT = `You are a Senior Full-Stack Engineer and AI Build Agent. 
If the user asks you to create a component, file, or build a feature, you MUST provide the code AND a special build command.

Format for building files:
[BUILD_FILE:path/to/file.js]
\`\`\`javascript
// code here
\`\`\`

Example: "Build a navbar"
Response: "I'll build that for you. [BUILD_FILE:src/components/Navbar.jsx] \`\`\`javascript ... \`\`\`"

Always provide COMPLETE, working code. NEVER truncate code or use comments like "// ... rest of code".
If you are modifying an existing file, you MUST provide the ENTIRE file content with your changes integrated.`;

async function tryChat(entry, messages, model) {
  if (entry.provider === "gemini") {
    const genAI = new GoogleGenerativeAI(entry.key);
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));
    
    const chat = geminiModel.startChat({
      history: history,
      systemInstruction: SYSTEM_PROMPT
    });
    
    const lastMsg = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMsg);
    return result.response.text();
  } else if (entry.provider === "groq") {
    const groq = new Groq({ apiKey: entry.key });
    const completion = await groq.chat.completions.create({
      model: model || "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 8192,
      temperature: 0.2
    });
    return completion.choices[0]?.message?.content || "";
  } else {
    const openai = new OpenAI({ apiKey: entry.key });
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 16384,
      temperature: 0.2
    });
    return completion.choices[0]?.message?.content || "";
  }
}

// GET /api/ai/keys
router.get("/keys", async (req, res) => {
  try {
    const keys = (req.user.aiKeys || []).map(k => ({
      _id: k._id,
      last4: k.last4,
      label: k.label,
      provider: getProvider(decryptString(k.encryptedApiKey)),
      createdAt: k.createdAt
    }));
    res.json({ keys });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ai/keys
router.post("/keys", async (req, res) => {
  try {
    const { apiKey, label } = req.body;
    if (!apiKey) return res.status(400).json({ error: "Invalid key" });
    const provider = getProvider(apiKey);
    const newKey = {
      encryptedApiKey: encryptString(apiKey),
      last4: maskLast4(apiKey),
      label: label || `${provider.toUpperCase()} Key`,
      createdAt: new Date()
    };
    if (!req.user.aiKeys) req.user.aiKeys = [];
    req.user.aiKeys.push(newKey);
    req.user.openai = newKey;
    await req.user.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/chat", async (req, res) => {
  const entries = getAllKeyEntries(req.user);
  if (entries.length === 0) return res.status(400).json({ error: "No AI keys" });
  let lastError = null;
  for (const entry of entries) {
    try {
      const text = await tryChat(entry, req.body.messages, req.body.model);
      return res.json({ ok: true, text });
    } catch (e) {
      lastError = e;
      if (e.status === 429 || e.status === 401) continue;
    }
  }
  res.status(500).json({ error: lastError?.message || "AI failed" });
});

// BUILD ACTION ENDPOINT
router.post("/action", async (req, res) => {
  try {
    const { projectId, action, path, content } = req.body;
    console.log(`[AI ACTION] Received action: ${action}, path: ${path}, projectId: ${projectId}`);
    console.log(`[AI ACTION] Content length: ${content?.length}`);

    if (action === "build_file") {
      const normalizedPath = path.trim().startsWith("/") ? path.trim() : "/" + path.trim();
      let file = await File.findOne({ project: projectId, path: normalizedPath });
      
      const fileName = normalizedPath.split("/").pop();
      const parentPath = normalizedPath.split("/").slice(0, -1).join("/") || "/";
      const ext = fileName.split(".").pop();
      const langMap = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", md: "markdown", html: "html", css: "css" };
      const language = langMap[ext] || "javascript";

      if (file) {
        console.log(`[AI ACTION] Updating existing file: ${file._id}`);
        file.content = content;
        file.lastEditedBy = req.user._id;
        file.lastEditedAt = new Date();
        await file.save();
      } else {
        console.log(`[AI ACTION] Creating new file: ${normalizedPath}`);
        file = await File.create({
          name: fileName,
          path: normalizedPath,
          parentPath,
          content,
          language,
          project: projectId,
          lastEditedBy: req.user._id
        });
        await Project.findByIdAndUpdate(projectId, { $push: { files: file._id } });
        console.log(`[AI ACTION] Created file: ${file._id}`);
      }

      // Notify collaborators via socket
      const { io } = require("../index");
      if (io) io.to(projectId).emit("file_created", file);

      return res.json({ ok: true, file });
    }
    res.status(400).json({ error: "Unknown action" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
