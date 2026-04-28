const express = require("express");
const OpenAI = require("openai");
const { authMiddleware } = require("../middleware/auth");
const { encryptString, decryptString } = require("../utils/crypto");

const router = express.Router();
router.use(authMiddleware);

function maskLast4(key) {
  if (!key) return "";
  return key.slice(-4);
}

/**
 * Helper to get a random working key from the user's pool
 */
function getRandomKey(user) {
  const pool = user.aiKeys || [];
  // Fallback to legacy single key if pool is empty
  if (pool.length === 0) {
    return user.openai?.encryptedApiKey ? decryptString(user.openai.encryptedApiKey) : null;
  }
  const randomEntry = pool[Math.floor(Math.random() * pool.length)];
  return decryptString(randomEntry.encryptedApiKey);
}

// GET /api/ai/keys — list all keys (masked)
router.get("/keys", async (req, res) => {
  try {
    const keys = (req.user.aiKeys || []).map(k => ({
      _id: k._id,
      last4: k.last4,
      label: k.label,
      createdAt: k.createdAt
    }));
    res.json({ keys });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/keys — add a new key to the pool
router.post("/keys", async (req, res) => {
  try {
    const { apiKey, label } = req.body;
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 20) {
      return res.status(400).json({ error: "Invalid API key" });
    }

    const newKey = {
      encryptedApiKey: encryptString(apiKey),
      last4: maskLast4(apiKey),
      label: label || `Key ${maskLast4(apiKey)}`,
      createdAt: new Date()
    };

    if (!req.user.aiKeys) req.user.aiKeys = [];
    req.user.aiKeys.push(newKey);
    
    // Also update legacy field for backward compatibility
    req.user.openai = {
      encryptedApiKey: newKey.encryptedApiKey,
      last4: newKey.last4,
      createdAt: newKey.createdAt
    };

    await req.user.save();
    res.json({ ok: true, key: req.user.aiKeys[req.user.aiKeys.length - 1] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/ai/keys/:id — remove a key from the pool
router.delete("/keys/:id", async (req, res) => {
  try {
    req.user.aiKeys = req.user.aiKeys.filter(k => k._id.toString() !== req.params.id);
    await req.user.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/chat — basic assistant chat using rotation
router.post("/chat", async (req, res) => {
  try {
    const { messages, model } = req.body;
    const apiKey = getRandomKey(req.user);
    if (!apiKey) return res.status(400).json({ error: "No AI API keys configured" });

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: Array.isArray(messages) ? messages : [],
      temperature: 0.2
    });

    const text = completion.choices?.[0]?.message?.content || "";
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/suggest — inline code suggestions using rotation
router.post("/suggest", async (req, res) => {
  try {
    const { code, language, fileName } = req.body;
    const apiKey = getRandomKey(req.user);
    if (!apiKey) return res.status(400).json({ error: "No AI API keys configured" });

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert AI pair programmer. Complete the following ${language} code for file "${fileName}". Provide ONLY the suggested code completion without markdown blocks or explanations.`
        },
        {
          role: "user",
          content: code
        }
      ],
      max_tokens: 100,
      temperature: 0
    });

    const suggestion = completion.choices?.[0]?.message?.content || "";
    res.json({ ok: true, suggestion });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
