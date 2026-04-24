import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { z } from "zod";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { WebSocketServer } from "ws";
import { FileModel } from "./models/File.js";
import { getYDoc, setupWSConnection } from "./yjs/server.js";

const env = z
  .object({
    PORT: z.coerce.number().default(5001),
    REDIS_URL: z.string().optional().default(""),
    ENABLE_REDIS_ADAPTER: z
      .enum(["true", "false"])
      .optional()
      .default("false")
      .transform((v) => v === "true"),
    MONGO_URI: z.string().default("mongodb://localhost:27017/collabDB"),
    JWT_SECRET: z.string().default("change-me"),
    ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  })
  .parse(process.env);

const app = express();
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true, service: "ws" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
    credentials: true,
  },
});

// Mongo connection for Yjs persistence (Phase 1 persistence = snapshot to File.content)
mongoose
  .connect(env.MONGO_URI)
  // eslint-disable-next-line no-console
  .then(() => console.log("[ws] mongo connected"))
  // eslint-disable-next-line no-console
  .catch((e) => console.warn("[ws] mongo connection failed:", e?.message ?? e));

// Redis adapter makes Socket.IO horizontally scalable.
// In Phase 1 we keep Redis optional so local dev works without Docker.
if (env.ENABLE_REDIS_ADAPTER && env.REDIS_URL) {
  let pub: Redis | undefined;
  let sub: Redis | undefined;

  try {
    const redisOpts: Redis.RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: () => null,
      reconnectOnError: () => false,
    };

    pub = new Redis(env.REDIS_URL, redisOpts);
    sub = new Redis(env.REDIS_URL, redisOpts);

    for (const client of [pub, sub]) {
      client.on("error", (err) => {
        // eslint-disable-next-line no-console
        console.warn("[ws] redis error:", err?.message ?? err);
      });
    }

    await pub.connect();
    await sub.connect();

    io.adapter(createAdapter(pub, sub));
    // eslint-disable-next-line no-console
    console.log("[ws] redis adapter enabled");
  } catch (err) {
    pub?.disconnect();
    sub?.disconnect();
    // eslint-disable-next-line no-console
    console.warn(
      "[ws] redis not reachable, running without adapter:",
      err instanceof Error ? err.message : err,
    );
  }
}

// ── Yjs websocket server (CRDT) ──────────────────────────────────────────────
// Room naming: `file:<fileId>` so each file has its own Y.Doc.
// Auth: clients pass `?token=JWT` (Phase 2+ RBAC enforcement will reject writes for viewers).
const yWss = new WebSocketServer({ noServer: true });

// Persist snapshots to Mongo with a small debounce per doc.
const persistTimers = new Map<string, NodeJS.Timeout>();
const persistHooked = new Set<string>();
function schedulePersist(docName: string, doc: any) {
  const existing = persistTimers.get(docName);
  if (existing) clearTimeout(existing);

  const t = setTimeout(async () => {
    try {
      const m = /^file:(?<fileId>[a-fA-F0-9]{24})$/.exec(docName);
      const fileId = m?.groups?.fileId;
      if (!fileId) return;

      const text = doc.getText("monaco").toString();
      await FileModel.findByIdAndUpdate(fileId, {
        content: text,
        size: Buffer.byteLength(text, "utf8"),
        lastEditedAt: new Date(),
      }).exec();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[ws] yjs persist failed:", e instanceof Error ? e.message : e);
    }
  }, 750);

  persistTimers.set(docName, t);
}

yWss.on("connection", (conn, req) => {
  const url = new URL(req.url ?? "/", "http://local");
  const token = url.searchParams.get("token") ?? "";
  try {
    jwt.verify(token, env.JWT_SECRET);
  } catch {
    conn.close(1008, "unauthorized");
    return;
  }

  const docName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  if (!docName) {
    conn.close(1008, "missing doc name");
    return;
  }

  const doc = getYDoc(docName);
  if (!persistHooked.has(docName)) {
    persistHooked.add(docName);
    doc.on("update", () => schedulePersist(docName, doc));
  }

  // Wire the connection to the doc (sync + awareness).
  setupWSConnection(conn as any, req.url ?? "", { docName });
});

server.on("upgrade", (req, socket, head) => {
  const u = new URL(req.url ?? "/", "http://local");
  if (!u.pathname.startsWith("/yjs/")) return;
  yWss.handleUpgrade(req, socket, head, (ws) => yWss.emit("connection", ws, req));
});

io.on("connection", (socket) => {
  socket.emit("server:hello", { socketId: socket.id });

  socket.on("room:join", ({ roomId }: { roomId: string }) => {
    socket.join(roomId);
    io.to(roomId).emit("room:presence", { type: "join", socketId: socket.id });
  });

  socket.on("room:leave", async ({ roomId }: { roomId: string }) => {
    await socket.leave(roomId);
    io.to(roomId).emit("room:presence", { type: "leave", socketId: socket.id });
  });

  socket.on("disconnect", () => {
    // Room-level presence is handled in later phases (tracked by project/user IDs).
  });
});

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ws] listening on :${env.PORT}`);
});

