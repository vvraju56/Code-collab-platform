const { socketAuth } = require("../middleware/auth");
const File = require("../models/File");
const ChatMessage = require("../models/ChatMessage");
const Project = require("../models/Project");

// In-memory stores (use Redis for multi-server production)
const roomUsers = new Map();        // roomId -> Map<socketId, userInfo>
const fileContent = new Map();      // fileId -> current content string
const activeCursors = new Map();    // roomId -> Map<socketId, cursorInfo>
const globalUsers = new Set();      // all connected socket ids

function initSocket(io) {
  // ─── AUTH MIDDLEWARE ───────────────────────────────────────────────────────
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const user = socket.user;
    globalUsers.add(socket.id);

    console.log(`🔌 Connected: ${user.username} (${socket.id})`);
    io.emit("global_user_count", globalUsers.size);

    // ─── DASHBOARD ROOM ─────────────────────────────────────────────────────
    socket.on("join_room", (roomId) => {
      socket.join(roomId);

      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
      roomUsers.get(roomId).set(socket.id, {
        socketId: socket.id,
        username: user.username,
        userId: user._id,
        cursorColor: user.cursorColor,
        joinedAt: Date.now()
      });

      // Notify others
      socket.to(roomId).emit("user_joined", {
        socketId: socket.id,
        username: user.username,
        userId: user._id,
        cursorColor: user.cursorColor
      });

      // Send current room users to requester
      const users = Array.from(roomUsers.get(roomId).values());
      socket.emit("room_users", users);
    });

    socket.on("get_room_users", (roomId) => {
      const users = roomUsers.has(roomId)
        ? Array.from(roomUsers.get(roomId).values())
        : [];
      socket.emit("room_users", users);
    });

    // ─── PROJECT / EDITOR ROOM ──────────────────────────────────────────────
    socket.on("join_project", async ({ projectId }) => {
      const room = `project:${projectId}`;
      socket.join(room);
      socket.currentProject = projectId;

      if (!roomUsers.has(room)) roomUsers.set(room, new Map());
      roomUsers.get(room).set(socket.id, {
        socketId: socket.id,
        username: user.username,
        userId: user._id.toString(),
        cursorColor: user.cursorColor,
        avatar: user.avatar,
        joinedAt: Date.now()
      });

      if (!activeCursors.has(room)) activeCursors.set(room, new Map());

      // Notify all in room
      const users = Array.from(roomUsers.get(room).values());
      io.to(room).emit("project_users", users);

      socket.to(room).emit("user_joined_project", {
        socketId: socket.id,
        username: user.username,
        userId: user._id,
        cursorColor: user.cursorColor
      });

      console.log(`📁 ${user.username} joined project ${projectId}`);
    });

    // ─── WebRTC SIGNALING ───────────────────────────────────────────────────
    socket.on("webrtc_offer", ({ to, offer, projectId }) => {
      console.log('[Socket] Forwarding offer to:', to);
      io.to(to).emit("webrtc_offer", {
        from: socket.id,
        offer
      });
    });

    socket.on("webrtc_answer", ({ to, answer, projectId }) => {
      console.log('[Socket] Forwarding answer to:', to);
      io.to(to).emit("webrtc_answer", {
        from: socket.id,
        answer
      });
    });

    socket.on("webrtc_ice", ({ to, candidate, projectId }) => {
      io.to(to).emit("webrtc_ice", {
        from: socket.id,
        candidate
      });
    });

    // Legacy webrtc_signal handler
    socket.on("webrtc_signal", ({ to, signal, type, projectId }) => {
      io.to(to).emit("webrtc_signal", {
        from: socket.id,
        signal,
        type,
        user: {
          username: user.username,
          socketId: socket.id
        }
      });
    });

    socket.on("toggle_media", ({ projectId, type, enabled }) => {
      const room = `project:${projectId}`;
      socket.to(room).emit("user_media_toggled", {
        socketId: socket.id,
        type, // 'video' | 'audio' | 'screen'
        enabled
      });
    });

    // ─── CALL NOTIFICATIONS ───────────────────────────────────────────────────
    socket.on("call_started", ({ projectId }) => {
      const room = `project:${projectId}`;
      socket.to(room).emit("call_started", {
        from: socket.id,
        username: user.username
      });
      console.log(`[Call] ${user.username} started a call in project ${projectId}`);
    });

    socket.on("call_ended", ({ projectId }) => {
      const room = `project:${projectId}`;
      socket.to(room).emit("call_ended", {
        from: socket.id
      });
      console.log(`[Call] ${user.username} ended the call`);
    });

    socket.on("call_left", ({ projectId }) => {
      const room = `project:${projectId}`;
      socket.to(room).emit("call_left", {
        from: socket.id,
        username: user.username
      });
      console.log(`[Call] ${user.username} left the call`);
    });

    socket.on("call_joined", ({ projectId }) => {
      const room = `project:${projectId}`;
      socket.to(room).emit("call_joined", {
        from: socket.id,
        username: user.username
      });
      console.log(`[Call] ${user.username} joined the call`);
    });

    // ─── SHARED DEBUGGING ───────────────────────────────────────────────────
    socket.on("debug_event", ({ projectId, event, data }) => {
      const room = `project:${projectId}`;
      // event: 'breakpoint_added' | 'breakpoint_removed' | 'execution_paused' | 'step'
      socket.to(room).emit("debug_event", {
        from: socket.id,
        event,
        data
      });
    });

    socket.on("leave_project", ({ projectId }) => {
      const room = `project:${projectId}`;
      socket.leave(room);
      _leaveRoom(socket, room, io);
    });

    // ─── FILE OPERATIONS ────────────────────────────────────────────────────

    // User opens a file
    socket.on("open_file", async ({ fileId, projectId }) => {
      const fileRoom = `file:${fileId}`;
      socket.join(fileRoom);
      socket.currentFile = fileId;

      // Serve cached content or fetch from DB
      if (!fileContent.has(fileId)) {
        try {
          const file = await File.findById(fileId);
          if (file) fileContent.set(fileId, file.content || "");
        } catch (e) { console.error(e); }
      }

      socket.emit("file_content", {
        fileId,
        content: fileContent.get(fileId) || ""
      });

      // Broadcast cursors already in file
      if (activeCursors.has(`project:${projectId}`)) {
        const cursors = Array.from(activeCursors.get(`project:${projectId}`).values())
          .filter(c => c.fileId === fileId);
        socket.emit("cursor_batch", cursors);
      }
    });

    // Operational Transform — code change broadcast
    socket.on("code_change", ({ fileId, projectId, delta, content, version }) => {
      const fileRoom = `file:${fileId}`;

      // Update in-memory content
      if (content !== undefined) fileContent.set(fileId, content);

      // Broadcast change to all other editors
      socket.to(fileRoom).emit("code_change", {
        fileId,
        delta,
        content,
        version,
        sender: {
          socketId: socket.id,
          username: user.username,
          cursorColor: user.cursorColor
        }
      });

      // Debounced save to DB (every 3 seconds of inactivity)
      if (socket._saveTimer) clearTimeout(socket._saveTimer);
      socket._saveTimer = setTimeout(async () => {
        try {
          if (content !== undefined) {
            await File.findByIdAndUpdate(fileId, {
              content,
              lastEditedBy: user._id,
              lastEditedAt: new Date(),
              size: Buffer.byteLength(content, "utf8")
            });
            await Project.findByIdAndUpdate(projectId, { lastActivity: new Date() });
          }
        } catch (e) { console.error("Auto-save failed:", e); }
      }, 3000);
    });

    // ─── CURSOR TRACKING ────────────────────────────────────────────────────
    socket.on("cursor_move", ({ projectId, fileId, line, column, selection }) => {
      const room = `project:${projectId}`;
      const fileRoom = `file:${fileId}`;

      const cursorData = {
        socketId: socket.id,
        username: user.username,
        cursorColor: user.cursorColor,
        fileId,
        line,
        column,
        selection,
        timestamp: Date.now()
      };

      if (activeCursors.has(room)) {
        activeCursors.get(room).set(socket.id, cursorData);
      }

      // Broadcast to everyone in the same file
      socket.to(fileRoom).emit("cursor_update", cursorData);
    });

    // ─── CHAT ────────────────────────────────────────────────────────────────
    socket.on("send_message", async ({ projectId, message, type }) => {
      try {
        const room = `project:${projectId}`;

        const chatMsg = await ChatMessage.create({
          project: projectId,
          sender: user._id,
          message,
          type: type || "text"
        });

        await chatMsg.populate("sender", "username cursorColor avatar");

        io.to(room).emit("new_message", {
          _id: chatMsg._id,
          message: chatMsg.message,
          type: chatMsg.type,
          sender: chatMsg.sender,
          createdAt: chatMsg.createdAt
        });
      } catch (e) { console.error("Chat error:", e); }
    });

    // Fetch chat history
    socket.on("get_chat_history", async ({ projectId }) => {
      try {
        const messages = await ChatMessage.find({ project: projectId })
          .populate("sender", "username cursorColor avatar")
          .sort({ createdAt: -1 })
          .limit(50);

        socket.emit("chat_history", messages.reverse());
      } catch (e) { console.error("Chat history error:", e); }
    });

    // ─── TYPING INDICATOR ───────────────────────────────────────────────────
    socket.on("typing_start", ({ projectId }) => {
      socket.to(`project:${projectId}`).emit("user_typing", {
        username: user.username,
        cursorColor: user.cursorColor
      });
    });

    socket.on("typing_stop", ({ projectId }) => {
      socket.to(`project:${projectId}`).emit("user_stopped_typing", {
        username: user.username
      });
    });

    // ─── DISCONNECT ──────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      globalUsers.delete(socket.id);
      io.emit("global_user_count", globalUsers.size);

      // Remove from all rooms
      for (const [roomId] of roomUsers) {
        _leaveRoom(socket, roomId, io);
      }

      console.log(`🔴 Disconnected: ${user.username} (${socket.id})`);
    });
  });
}

function _leaveRoom(socket, roomId, io) {
  const user = socket.user;

  if (roomUsers.has(roomId)) {
    roomUsers.get(roomId).delete(socket.id);

    const remaining = Array.from(roomUsers.get(roomId).values());

    if (roomId.startsWith("project:")) {
      io.to(roomId).emit("project_users", remaining);
      io.to(roomId).emit("user_left_project", {
        socketId: socket.id,
        username: user.username
      });
    } else {
      io.to(roomId).emit("user_left", {
        socketId: socket.id,
        username: user.username
      });
      io.to(roomId).emit("room_users", remaining);
    }

    // Remove cursor
    if (activeCursors.has(roomId)) {
      activeCursors.get(roomId).delete(socket.id);
      io.to(roomId).emit("cursor_remove", { socketId: socket.id });
    }
  }
}

module.exports = { initSocket };
