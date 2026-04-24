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

// PUT /api/ai/key — store/update user's OpenAI API key (BYOK)
router.put("/key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 20) {
      return res.status(400).json({ error: "Invalid API key" });
    }

    req.user.openai = {
      encryptedApiKey: encryptString(apiKey),
      keyVersion: 1,
      last4: maskLast4(apiKey),
      createdAt: new Date()
    };
    await req.user.save();

    res.json({ ok: true, last4: req.user.openai.last4 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/ai/key — remove user's key
router.delete("/key", async (req, res) => {
  try {
    req.user.openai = { encryptedApiKey: "", keyVersion: 1, last4: "", createdAt: null };
    await req.user.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/chat — basic assistant chat
router.post("/chat", async (req, res) => {
  try {
    const { messages, model } = req.body;
    const encKey = req.user.openai?.encryptedApiKey;
    if (!encKey) return res.status(400).json({ error: "OpenAI API key not set" });

    const apiKey = decryptString(encKey);
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

// POST /api/ai/suggest — inline code suggestions
router.post("/suggest", async (req, res) => {
  try {
    const { code, language, fileName } = req.body;
    const encKey = req.user.openai?.encryptedApiKey;
    if (!encKey) return res.status(400).json({ error: "OpenAI API key not set" });

    const apiKey = decryptString(encKey);
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

