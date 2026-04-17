require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const { initSocket } = require("./socket/socketManager");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const fileRoutes = require("./routes/files");
const versionRoutes = require("./routes/versions");
const executionRoutes = require("./routes/execution");
const dashboardRoutes = require("./routes/dashboard");

const app = express();
const server = http.createServer(app);

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
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

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() }));

// ─── SOCKET ENGINE ───────────────────────────────────────────────────────────
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
