import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useEditor } from "../hooks/useEditor";
import CollabEditor from "../components/editor/CollabEditor";
import FileTree from "../components/editor/FileTree";
import ChatPanel from "../components/chat/ChatPanel";
import VersionPanel from "../components/editor/VersionPanel";
import ExecutionPanel from "../components/editor/ExecutionPanel";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function EditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [project, setProject] = useState(null);
  const [rightPanel, setRightPanel] = useState("chat"); // chat | versions | run
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [saving, setSavingState] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const {
    files, activeFile, content, projectUsers, cursors,
    openFile, handleCodeChange, handleCursorMove, createFile, deleteFile
  } = useEditor(projectId, socket);

  // Load project info
  useEffect(() => {
    axios.get(`${API}/projects/${projectId}`)
      .then(r => setProject(r.data))
      .catch(() => navigate("/dashboard"));
  }, [projectId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviting(true);
    try {
      const { data } = await axios.post(`${API}/projects/${projectId}/collaborators`, {
        username: inviteUsername.trim(),
        role: "editor"
      });
      setProject(data);
      setInviteUsername("");
      setShowInvite(false);
    } catch (err) {
      alert(err.response?.data?.error || "Could not invite user");
    } finally { setInviting(false); }
  };

  const RIGHT_TABS = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "versions", label: "History", icon: "🔖" },
    { id: "run", label: "Run", icon: "▶" }
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <header className="flex items-center h-12 px-4 border-b border-slate-800 bg-slate-950 shrink-0 z-30 gap-3">
        {/* Logo + back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition group"
          >
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-[10px]">CB</span>
            </div>
            <span className="text-xs font-black text-slate-500 group-hover:text-white transition hidden sm:block">← Dashboard</span>
          </button>

          <span className="text-slate-700">/</span>

          {project && (
            <span className="text-sm font-black text-white tracking-tight">{project.name}</span>
          )}

          {activeFile && (
            <>
              <span className="text-slate-700">/</span>
              <span className="text-sm font-mono text-blue-400">{activeFile.name}</span>
            </>
          )}
        </div>

        {/* Center — online users */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {projectUsers.slice(0, 6).map((u, i) => (
            <div
              key={u.socketId || i}
              title={u.username}
              className="relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white border-2 border-slate-950 shadow-lg"
              style={{
                backgroundColor: u.cursorColor || "#3b82f6",
                marginLeft: i > 0 ? "-6px" : "0"
              }}
            >
              {u.username?.charAt(0).toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-slate-950" />
            </div>
          ))}
          {projectUsers.length > 0 && (
            <span className="text-[10px] font-bold text-slate-500 ml-1">
              {projectUsers.length} live
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider hidden sm:block">Auto-saving</span>
          </div>

          {/* Invite button */}
          <button
            onClick={() => setShowInvite(v => !v)}
            className="px-3 py-1.5 text-[10px] font-black text-slate-300 uppercase tracking-widest border border-slate-700 hover:border-blue-500 hover:text-blue-400 rounded-xl transition"
          >
            + Invite
          </button>

          {/* Socket status */}
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            title={connected ? "Connected" : "Disconnected"} />
        </div>
      </header>

      {/* ── INVITE DROPDOWN ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-12 right-4 z-50 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4"
          >
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Invite Collaborator</p>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                autoFocus
                value={inviteUsername}
                onChange={e => setInviteUsername(e.target.value)}
                placeholder="username"
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button type="submit" disabled={inviting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition disabled:opacity-50">
                {inviting ? "..." : "Invite"}
              </button>
            </form>
            {project?.collaborators?.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Team</p>
                {project.collaborators.map(c => (
                  <div key={c.user?._id} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-black text-white">
                      {c.user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-400">{c.user?.username}</span>
                    <span className="ml-auto text-[9px] text-slate-600 uppercase">{c.role}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LAYOUT ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: File Tree */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 border-r border-slate-800 bg-slate-950 overflow-hidden"
              style={{ width: 220 }}
            >
              <FileTree
                files={files}
                activeFile={activeFile}
                onOpenFile={openFile}
                onCreateFile={createFile}
                onDeleteFile={deleteFile}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="shrink-0 w-4 flex items-center justify-center bg-slate-900 border-r border-slate-800 hover:bg-slate-800 transition text-slate-600 hover:text-white"
          title={sidebarOpen ? "Hide Explorer" : "Show Explorer"}
        >
          <span className="text-[10px]">{sidebarOpen ? "‹" : "›"}</span>
        </button>

        {/* MIDDLE: Monaco Editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] min-w-0">
          {/* Tab bar */}
          {activeFile && (
            <div className="flex items-center h-9 border-b border-slate-800 bg-slate-950 px-2 gap-1 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
                <span className="text-xs">📄</span>
                <span className="text-xs font-mono text-white">{activeFile.name}</span>
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500"
                  title="Auto-saved" />
              </div>
              <div className="flex-1" />
              <span className="text-[9px] font-mono text-slate-600 uppercase px-2">{activeFile.language}</span>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            <CollabEditor
              file={activeFile}
              content={content}
              onChange={handleCodeChange}
              onCursorChange={handleCursorMove}
              cursors={cursors}
            />
          </div>

          {/* Status bar */}
          <div className="h-6 flex items-center px-4 gap-4 bg-blue-600 shrink-0">
            <span className="text-[10px] font-bold text-blue-100">
              {connected ? "● Connected" : "○ Disconnected"}
            </span>
            {activeFile && (
              <>
                <span className="text-[10px] text-blue-200">{activeFile.language}</span>
                <span className="text-[10px] text-blue-200">{content.split("\n").length} lines</span>
                <span className="text-[10px] text-blue-200">{content.length} chars</span>
              </>
            )}
            <span className="ml-auto text-[10px] text-blue-200 font-mono">CodeBloc v1.0</span>
          </div>
        </div>

        {/* Right panel toggle */}
        <button
          onClick={() => setRightOpen(v => !v)}
          className="shrink-0 w-4 flex items-center justify-center bg-slate-900 border-l border-slate-800 hover:bg-slate-800 transition text-slate-600 hover:text-white"
        >
          <span className="text-[10px]">{rightOpen ? "›" : "‹"}</span>
        </button>

        {/* RIGHT: Panels */}
        <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 flex flex-col border-l border-slate-800 bg-slate-950 overflow-hidden"
              style={{ width: 300 }}
            >
              {/* Tab switcher */}
              <div className="flex border-b border-slate-800 shrink-0">
                {RIGHT_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setRightPanel(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition ${
                      rightPanel === t.id
                        ? "text-blue-400 border-b-2 border-blue-500 bg-blue-500/5"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden">
                {rightPanel === "chat" && (
                  <ChatPanel socket={socket} projectId={projectId} user={user} />
                )}
                {rightPanel === "versions" && (
                  <VersionPanel projectId={projectId} activeFile={activeFile} />
                )}
                {rightPanel === "run" && (
                  <ExecutionPanel content={content} language={activeFile?.language || "javascript"} />
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
