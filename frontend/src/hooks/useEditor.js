import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useYjsFile } from "./useYjsFile";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function useEditor(projectId, socket) {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [projectUsers, setProjectUsers] = useState([]);
  const [cursors, setCursors] = useState({}); // legacy socket cursors (kept for chat/presence phase)
  const saveTimerRef = useRef(null);

  const { ydoc, awareness, ytext, status: yStatus } = useYjsFile({
    fileId: activeFile?._id,
    token,
    enabled: Boolean(activeFile?._id),
  });

  const [content, setContent] = useState("");
  useEffect(() => {
    if (!ytext) return;
    const update = () => setContent(ytext.toString());
    update();
    ytext.observe(update);
    return () => ytext.unobserve(update);
  }, [ytext]);

  // Load files
  const loadFiles = useCallback(async () => {
    if (!projectId) return;
    const { data } = await axios.get(`${API}/files/project/${projectId}`);
    setFiles(data);
    if (data.length > 0 && !activeFile) openFile(data[0]);
  }, [projectId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit("join_project", { projectId });

    socket.on("project_users", (users) => setProjectUsers(users));
    socket.on("user_joined_project", (user) => {
      setProjectUsers(prev => {
        if (prev.find(u => u.socketId === user.socketId)) return prev;
        return [...prev, user];
      });
    });
    socket.on("user_left_project", ({ socketId }) => {
      setProjectUsers(prev => prev.filter(u => u.socketId !== socketId));
      setCursors(prev => { const n = { ...prev }; delete n[socketId]; return n; });
    });

    // CRDT: code sync is handled by Yjs provider (services/ws).

    return () => {
      socket.off("project_users");
      socket.off("user_joined_project");
      socket.off("user_left_project");
      socket.emit("leave_project", { projectId });
    };
  }, [socket, projectId, activeFile]);

  const openFile = useCallback((file) => {
    setActiveFile(file);
    setCursors({});
  }, [socket, projectId]);

  const handleCodeChange = useCallback((_newContent) => {
    // Monaco changes are bound to Yjs via y-monaco (in CollabEditor).
    // `content` state is derived from Y.Text and used for panels (Run/History/etc).
  }, []);

  const handleCursorMove = useCallback((position) => {
    // CRDT: cursor tracking migrates to Yjs awareness in the editor component.
    if (awareness && position && activeFile?._id) {
      const localState = awareness.getLocalState() || {};
      awareness.setLocalStateField("cursor", {
        fileId: activeFile._id,
        line: position.lineNumber,
        column: position.column,
      });
    }
  }, [awareness, activeFile]);

  const createFile = useCallback(async (name, language) => {
    const ext = name.split(".").pop();
    const { data } = await axios.post(`${API}/files`, {
      projectId,
      name,
      path: `/${name}`,
      language: language || getLangFromExt(ext),
      parentPath: "/"
    });
    setFiles(prev => [...prev, data]);
    openFile(data);
    return data;
  }, [projectId, openFile]);

  const deleteFile = useCallback(async (fileId) => {
    await axios.delete(`${API}/files/${fileId}`);
    setFiles(prev => prev.filter(f => f._id !== fileId));
    if (activeFile?._id === fileId) {
      const remaining = files.filter(f => f._id !== fileId);
      if (remaining.length > 0) openFile(remaining[0]);
      else { setActiveFile(null); setContent(""); }
    }
  }, [files, activeFile, openFile]);

  return {
    files, activeFile, content, saving, projectUsers, cursors,
    ydoc, ytext, awareness, yStatus,
    openFile, handleCodeChange, handleCursorMove, createFile, deleteFile, loadFiles
  };
}

function getLangFromExt(ext) {
  const map = { js: "javascript", ts: "typescript", py: "python", java: "java", cpp: "cpp", c: "c", go: "go", rs: "rust", php: "php", rb: "ruby", html: "html", css: "css", md: "markdown", json: "json", sh: "bash" };
  return map[ext] || "plaintext";
}
