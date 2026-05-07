require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { initSocket } = require("./socket/socketManager");
const setupWSConnection = require("y-websocket/bin/utils").setupWSConnection;

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const fileRoutes = require("./routes/files");
const versionRoutes = require("./routes/versions");
const executionRoutes = require("./routes/execution");
const dashboardRoutes = require("./routes/dashboard");
const aiRoutes = require("./routes/ai");
const githubRoutes = require("./routes/github");

const app = express();
const server = http.createServer(app);

// ─── YJS WEBSOCKET SERVER ─────────────────────────────────────────────────────
const wss = new WebSocket.Server({ noServer: true });
const File = require("./models/File");

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  let token = url.searchParams.get("token");

  if (!token && pathname.startsWith("/yjs")) {
    const decodedUrl = decodeURIComponent(request.url);
    if (decodedUrl.includes("token=")) {
      token = decodedUrl.split("token=")[1].split("&")[0].split("?")[0];
    }
  }

  if (pathname.startsWith("/yjs")) {
    if (!token) {
      console.log(`[YJS] ❌ Rejecting: No token`);
      return socket.destroy();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User = require("./models/User");
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) return socket.destroy();
      request.user = user;
      console.log(`[YJS] ✅ User ${user.username} authorized`);

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } catch (e) {
      console.log(`[YJS] ❌ Invalid token: ${e.message}`);
      socket.destroy();
    }
  }
});

wss.on("connection", (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = decodeURIComponent(url.pathname).split("/").pop() || "default";
  console.log(`[YJS] 🔗 Room: ${roomName}`);

  setupWSConnection(conn, req, { docName: roomName, gc: true });

  const fileIdMatch = roomName.match(/^file:([a-f\d]{24})$/);
  if (fileIdMatch) {
    const fileId = fileIdMatch[1];
    const { getYDoc } = require("y-websocket/bin/utils");
    const doc = getYDoc(roomName);
    const ytext = doc.getText("monaco");

    if (ytext.length === 0) {
      File.findById(fileId).then(file => {
        if (file?.content) {
          console.log(`[YJS] 📥 Loading content (${file.content.length} chars)`);
          ytext.insert(0, file.content);
        }
      });
    }

    let saveTimeout;
    doc.on("update", () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          await File.findByIdAndUpdate(fileId, {
            content: ytext.toString(),
            lastEditedAt: new Date(),
            size: Buffer.byteLength(ytext.toString(), "utf8")
          });
        } catch (e) { console.error("[YJS] Save error:", e); }
      }, 3000);
    });
  }
});

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/versions", versionRoutes);
app.use("/api/execute", executionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/github", githubRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() }));

// ─── SOCKET ENGINE ───────────────────────────────────────────────────────────
const { setSocketIO } = require("./utils/socketHelpers");
setSocketIO(io);
initSocket(io);

// ─── MONGODB ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected — collabDB");
    server.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

module.exports = { io };
