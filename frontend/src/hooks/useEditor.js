import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function useEditor(projectId, socket) {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [projectUsers, setProjectUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const saveTimerRef = useRef(null);

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

    socket.on("code_change", ({ fileId, content: newContent, sender }) => {
      if (activeFile?._id === fileId) setContent(newContent);
    });

    socket.on("file_content", ({ fileId, content: fc }) => {
      if (activeFile?._id === fileId) setContent(fc);
    });

    socket.on("cursor_update", (cursorData) => {
      if (cursorData.fileId === activeFile?._id) {
        setCursors(prev => ({ ...prev, [cursorData.socketId]: cursorData }));
      }
    });

    socket.on("cursor_remove", ({ socketId }) => {
      setCursors(prev => { const n = { ...prev }; delete n[socketId]; return n; });
    });

    return () => {
      socket.off("project_users");
      socket.off("user_joined_project");
      socket.off("user_left_project");
      socket.off("code_change");
      socket.off("file_content");
      socket.off("cursor_update");
      socket.off("cursor_remove");
      socket.emit("leave_project", { projectId });
    };
  }, [socket, projectId, activeFile]);

  const openFile = useCallback((file) => {
    setActiveFile(file);
    setContent(file.content || "");
    setCursors({});
    if (socket) socket.emit("open_file", { fileId: file._id, projectId });
  }, [socket, projectId]);

  const handleCodeChange = useCallback((newContent) => {
    setContent(newContent);

    // Broadcast change
    if (socket && activeFile) {
      socket.emit("code_change", {
        fileId: activeFile._id,
        projectId,
        content: newContent,
        version: Date.now()
      });
    }

    // Debounced save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!activeFile) return;
      setSaving(true);
      try {
        await axios.put(`${API}/files/${activeFile._id}`, { content: newContent });
      } catch (e) { console.error("Save error:", e); }
      finally { setSaving(false); }
    }, 2000);
  }, [socket, activeFile, projectId]);

  const handleCursorMove = useCallback((position) => {
    if (socket && activeFile) {
      socket.emit("cursor_move", {
        projectId,
        fileId: activeFile._id,
        line: position.lineNumber,
        column: position.column
      });
    }
  }, [socket, activeFile, projectId]);

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
    openFile, handleCodeChange, handleCursorMove, createFile, deleteFile, loadFiles
  };
}

function getLangFromExt(ext) {
  const map = { js: "javascript", ts: "typescript", py: "python", java: "java", cpp: "cpp", c: "c", go: "go", rs: "rust", php: "php", rb: "ruby", html: "html", css: "css", md: "markdown", json: "json", sh: "bash" };
  return map[ext] || "plaintext";
}
