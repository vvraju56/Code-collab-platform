import http from "node:http";
import express from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import { ProjectModel } from "./models/Project.js";

const env = z
  .object({
    PORT: z.coerce.number().default(5002),
    MONGO_URI: z.string().default("mongodb://localhost:27017/collabDB"),
    JWT_SECRET: z.string().default("change-me"),
  })
  .parse(process.env);

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "executor" }));

mongoose
  .connect(env.MONGO_URI)
  // eslint-disable-next-line no-console
  .then(() => console.log("[executor] mongo connected"))
  // eslint-disable-next-line no-console
  .catch((e) => console.warn("[executor] mongo connection failed:", e?.message ?? e));

const server = http.createServer(app);

// ── Real-time terminal sharing (Phase 4) ─────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

type Session = {
  ptyProcess: any;
  clients: Set<any>;
};
const sessions = new Map<string, Session>(); // projectId -> session

async function getRole(projectId: string, userId: string) {
  const project = await ProjectModel.findById(projectId).lean();
  if (!project) return null;
  if (String(project.owner) === String(userId)) return "admin";
  const c = project.collaborators?.find((x: any) => String(x.user) === String(userId));
  return c?.role ?? null;
}

wss.on("connection", async (ws, req: any) => {
  const url = new URL(req.url ?? "/", "http://local");
  const token = url.searchParams.get("token") ?? "";
  const projectId = url.pathname.split("/").pop() ?? "";

  let userId = "";
  try {
    const decoded: any = jwt.verify(token, env.JWT_SECRET);
    userId = decoded.userId;
  } catch {
    ws.close(1008, "unauthorized");
    return;
  }

  const role = await getRole(projectId, userId);
  const canWrite = role === "editor" || role === "admin";

  let session = sessions.get(projectId);
  if (!session) {
    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    const p = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    });

    session = { ptyProcess: p, clients: new Set() };
    sessions.set(projectId, session);

    p.onData((data: string) => {
      for (const c of session!.clients) {
        try {
          c.send(JSON.stringify({ type: "terminal:data", data }));
        } catch {}
      }
    });
  }

  session.clients.add(ws);
  ws.send(JSON.stringify({ type: "terminal:hello", canWrite }));

  ws.on("message", (raw: any) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "terminal:input") {
      if (!canWrite) return;
      session!.ptyProcess.write(String(msg.data ?? ""));
    }
    if (msg.type === "terminal:resize") {
      const cols = Number(msg.cols) || 120;
      const rows = Number(msg.rows) || 30;
      try {
        session!.ptyProcess.resize(cols, rows);
      } catch {}
    }
  });

  ws.on("close", () => {
    session!.clients.delete(ws);
    if (session!.clients.size === 0) {
      try {
        session!.ptyProcess.kill();
      } catch {}
      sessions.delete(projectId);
    }
  });
});

server.on("upgrade", (req, socket, head) => {
  const u = new URL(req.url ?? "/", "http://local");
  if (!u.pathname.startsWith("/terminals/")) return;
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

// Phase 7 will replace this with Docker-based sandboxes.
app.post("/execute", (_req, res) => {
  res.status(501).json({
    ok: false,
    error: "Executor service scaffolded. Docker sandbox arrives in Phase 7.",
  });
});

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[executor] listening on :${env.PORT}`);
});

