import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useEditor } from "../hooks/useEditor";
import CollabEditor from "../components/editor/CollabEditor";
import FileTree from "../components/editor/FileTree";
import ChatPanel from "../components/chat/ChatPanel";
import VersionPanel from "../components/editor/VersionPanel";
import ExecutionPanel from "../components/editor/ExecutionPanel";
import AIAssistantPanel from "../components/editor/AIAssistantPanel";
import TerminalPanel from "../components/editor/TerminalPanel";
import ConferencePanel from "../components/editor/ConferencePanel";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function EditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [project, setProject] = useState(null);
  const [rightPanel, setRightPanel] = useState("chat"); // chat | versions | run | ai | terminal
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [rightOpen, setRightOpen] = useState(window.innerWidth > 1280);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [myRole, setMyRole] = useState("viewer");

  const {
    files, activeFile, content, projectUsers, cursors,
    ydoc, ytext, awareness,
    openFile, handleCodeChange, handleCursorMove, createFile, deleteFile
  } = useEditor(projectId, socket);

  // Responsive listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
        setRightOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load project info
  useEffect(() => {
    axios.get(`${API}/projects/${projectId}`)
      .then(r => setProject(r.data))
      .catch(() => {
        toast.error("Project not found");
        navigate("/dashboard");
      });
  }, [projectId]);

  useEffect(() => {
    if (!project || !user) return;
    if (project.owner?._id === user._id) {
      setMyRole("admin");
      return;
    }
    const c = project.collaborators?.find((x) => x.user?._id === user._id);
    setMyRole(c?.role || (project.isPublic ? "viewer" : "viewer"));
  }, [project, user]);

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
      toast.success(`Invited ${inviteUsername}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not invite user");
    } finally { setInviting(false); }
  };

  const RIGHT_TABS = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "versions", label: "History", icon: "🔖" },
    { id: "run", label: "Run", icon: "▶" },
    { id: "ai", label: "AI", icon: "✦" },
    { id: "terminal", label: "Term", icon: "⌘" },
    { id: "call", label: "Call", icon: "📹" }
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <header className="flex items-center h-14 px-3 sm:px-4 border-b border-slate-800 bg-slate-950 shrink-0 z-30 gap-2 sm:gap-3">
        {/* Left: Nav & Title */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <span className="text-white font-black text-[10px]">CB</span>
            </div>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden">
            <span className="text-slate-700 shrink-0">/</span>
            {project && (
              <span className="text-sm font-black text-white tracking-tight truncate max-w-[80px] sm:max-w-[150px]">
                {project.name}
              </span>
            )}
            {activeFile && (
              <>
                <span className="text-slate-700 shrink-0">/</span>
                <span className="text-sm font-mono text-blue-400 truncate max-w-[100px] sm:max-w-none">
                  {activeFile.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Center: Online users (desktop only) */}
        {!isMobile && (
          <div className="flex-1 flex items-center justify-center gap-1">
            {projectUsers.slice(0, 5).map((u, i) => (
              <div
                key={u.socketId || i}
                title={u.username}
                className="relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-slate-950 shadow-md hover:scale-110 transition-transform cursor-pointer"
                style={{
                  backgroundColor: u.cursorColor || "#3b82f6",
                  marginLeft: i > 0 ? "-8px" : "0",
                  zIndex: 10 - i
                }}
              >
                {u.username?.charAt(0).toUpperCase()}
              </div>
            ))}
            {projectUsers.length > 5 && (
              <span className="text-[9px] font-bold text-slate-500 ml-1">
                +{projectUsers.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Right: Status & Actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Status Indicators */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Sync</span>
          </div>

          <button
            onClick={() => setShowInvite(v => !v)}
            className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 text-[10px] font-black text-slate-300 hover:text-white uppercase tracking-widest border border-slate-800 hover:border-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
          >
            <span className="sm:mr-1">+</span><span className="hidden sm:inline">Invite</span>
          </button>
          
          {isMobile && (
             <button
              onClick={() => setRightOpen(!rightOpen)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border border-slate-800 ${rightOpen ? "bg-blue-600 text-white" : "text-slate-400"}`}
            >
              💬
            </button>
          )}
        </div>
      </header>

      {/* ── INVITE DROPDOWN ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-14 right-4 z-50 w-72 sm:w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Add Collaborator</p>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                autoFocus
                value={inviteUsername}
                onChange={e => setInviteUsername(e.target.value)}
                placeholder="Type username..."
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button type="submit" disabled={inviting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase rounded-xl transition disabled:opacity-50">
                {inviting ? "..." : "Send"}
              </button>
            </form>
            
            {project?.collaborators?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Team Members</span>
                  <span className="text-[9px] font-bold text-blue-500">{project.collaborators.length}</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {project.collaborators.map(c => (
                    <div key={c.user?._id} className="flex items-center gap-2 group">
                      <div className="w-5 h-5 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-black text-blue-400 border border-slate-700 group-hover:border-blue-500 transition-colors">
                        {c.user?.username?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-400 group-hover:text-white transition-colors truncate">{c.user?.username}</span>
                      <span className="ml-auto text-[8px] font-black text-slate-600 uppercase tracking-tighter">{c.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LAYOUT ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Sidebar Toggle Button (Mobile) */}
        {isMobile && !sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 bottom-20 z-40 w-12 h-12 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center text-white"
          >
            📁
          </button>
        )}

        {/* LEFT: File Tree */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={isMobile ? { x: -300 } : { width: 0 }}
              animate={isMobile ? { x: 0 } : { width: 220 }}
              exit={isMobile ? { x: -300 } : { width: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`z-40 shrink-0 border-r border-slate-800 bg-slate-950 overflow-hidden flex flex-col ${isMobile ? "fixed inset-y-0 left-0 w-[280px]" : ""}`}
            >
              {isMobile && (
                <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/50">
                  <span className="font-black text-xs uppercase tracking-widest text-white">Explorer</span>
                  <button onClick={() => setSidebarOpen(false)} className="text-slate-500">✕</button>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <FileTree
                  files={files}
                  activeFile={activeFile}
                  onOpenFile={(f) => { openFile(f); if (isMobile) setSidebarOpen(false); }}
                  onCreateFile={createFile}
                  onDeleteFile={deleteFile}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sidebar toggle (Desktop) */}
        {!isMobile && (
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="shrink-0 w-3 flex items-center justify-center bg-slate-950 border-r border-slate-900 hover:bg-slate-900 transition group"
          >
            <div className={`w-1 h-8 rounded-full bg-slate-800 group-hover:bg-blue-500 transition-colors ${sidebarOpen ? "" : "bg-blue-600"}`} />
          </button>
        )}

        {/* MIDDLE: Monaco Editor */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] min-w-0">
          {/* Tab bar */}
          <div className="flex items-center h-10 border-b border-slate-900 bg-slate-950 px-2 gap-1 shrink-0 overflow-x-auto no-scrollbar">
            {activeFile ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-t-lg border-x border-t border-slate-800 min-w-fit">
                <span className="text-xs">📄</span>
                <span className="text-xs font-mono text-white whitespace-nowrap">{activeFile.name}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title="Live Syncing" />
              </div>
            ) : (
              <div className="px-4 text-[10px] text-slate-600 uppercase font-black tracking-[0.2em] py-2">Select a file to start</div>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <CollabEditor
              file={activeFile}
              content={content}
              onChange={handleCodeChange}
              onCursorChange={handleCursorMove}
              cursors={cursors}
              ydoc={ydoc}
              ytext={ytext}
              awareness={awareness}
              readOnly={myRole === "viewer"}
              projectId={projectId}
            />
          </div>

          {/* Status bar */}
          <footer className="h-7 sm:h-6 flex items-center px-4 gap-4 bg-blue-600 shrink-0 text-white overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
               <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-white shadow-[0_0_8px_#fff]" : "bg-blue-300"}`} />
               <span className="text-[10px] font-black uppercase tracking-widest truncate">
                {connected ? "Live" : "Offline"}
              </span>
            </div>
            
            {activeFile && !isMobile && (
              <div className="flex items-center gap-4 border-l border-blue-500 pl-4 overflow-hidden">
                <span className="text-[10px] font-medium opacity-80 uppercase tracking-tighter truncate">{activeFile.language}</span>
                <span className="text-[10px] font-medium opacity-80 uppercase tracking-tighter hidden sm:block">UTF-8</span>
                <span className="text-[10px] font-medium opacity-80 uppercase tracking-tighter truncate">{content.split("\n").length} Lines</span>
              </div>
            )}
            
            <span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] opacity-60 hidden sm:block">CodeBloc Cloud</span>
          </footer>
        </main>

        {/* Right panel toggle (Desktop) */}
        {!isMobile && (
          <button
            onClick={() => setRightOpen(v => !v)}
            className="shrink-0 w-3 flex items-center justify-center bg-slate-950 border-l border-slate-900 hover:bg-slate-900 transition group"
          >
            <div className={`w-1 h-8 rounded-full bg-slate-800 group-hover:bg-blue-500 transition-colors ${rightOpen ? "" : "bg-blue-600"}`} />
          </button>
        )}

        {/* RIGHT: Panels */}
        <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.aside
              initial={isMobile ? { x: 300 } : { width: 0 }}
              animate={isMobile ? { x: 0 } : { width: 320 }}
              exit={isMobile ? { x: 300 } : { width: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`z-40 shrink-0 flex flex-col border-l border-slate-800 bg-slate-950 overflow-hidden ${isMobile ? "fixed inset-y-0 right-0 w-[85%] max-w-[400px]" : ""}`}
            >
              {/* Mobile overlay back */}
              {isMobile && (
                <div className="h-14 flex items-center px-4 border-b border-slate-800 bg-slate-900/50">
                   <button onClick={() => setRightOpen(false)} className="text-slate-500 mr-4">✕</button>
                   <span className="font-black text-xs uppercase tracking-widest text-white">Collaboration</span>
                </div>
              )}

              {/* Tab switcher */}
              <div className="flex border-b border-slate-800 shrink-0 bg-slate-900/20">
                {RIGHT_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setRightPanel(t.id)}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 sm:py-3 transition-all relative ${
                      rightPanel === t.id
                        ? "text-blue-400"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span className="text-sm mb-1">{t.icon}</span>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                    {rightPanel === t.id && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden relative">
                {rightPanel === "chat" && (
                  <ChatPanel socket={socket} projectId={projectId} user={user} />
                )}
                {rightPanel === "versions" && (
                  <VersionPanel projectId={projectId} activeFile={activeFile} />
                )}
                {rightPanel === "run" && (
                  <ExecutionPanel content={content} language={activeFile?.language || "javascript"} />
                )}
                {rightPanel === "ai" && (
                  <AIAssistantPanel
                    content={content}
                    language={activeFile?.language || "javascript"}
                    readOnly={myRole === "viewer"}
                  />
                )}
                {rightPanel === "terminal" && (
                  <TerminalPanel projectId={projectId} />
                )}
                {rightPanel === "call" && (
                  <ConferencePanel projectId={projectId} />
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
        
        {/* Mobile Backdrop */}
        {isMobile && (sidebarOpen || rightOpen) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSidebarOpen(false); setRightOpen(false); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          />
        )}
      </div>
    </div>
  );
}
