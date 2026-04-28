import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useProjects } from "../hooks/useProjects";
import axios from "axios";
import { toast } from "react-hot-toast";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const LANGUAGES = ["javascript","typescript","python","java","cpp","c","go","rust","php","ruby","html","css","markdown"];
const LANG_COLORS = { javascript:"#F7DF1E", typescript:"#3178C6", python:"#3776AB", java:"#ED8B00", cpp:"#00599C", go:"#00ADD8", rust:"#CE422B", html:"#E34F26", css:"#1572B6", markdown:"#083FA1" };

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { socket, connected, globalCount } = useSocket();
  const { projects, loading, createProject, deleteProject } = useProjects();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return ["projects", "members", "stats", "settings"].includes(tab) ? tab : "projects";
  });
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [activeMembers, setActiveMembers] = useState([]);
  const [stats, setStats] = useState({ totalProjects: 0, totalUsers: 0, totalCommits: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTab === "projects") {
      params.delete("tab");
    } else {
      params.set("tab", activeTab);
    }
    const newRelativePathQuery = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState(null, "", newRelativePathQuery);
  }, [activeTab]);

  // AI Settings state
  const [aiKeys, setAiKeys] = useState([]);
  const [newKey, setNewKey] = useState({ key: "", label: "" });
  const [savingKey, setSavingKey] = useState(false);

  // New project form
  const [newProject, setNewProject] = useState({ name: "", description: "", language: "javascript", isPublic: false });
  const [creating, setCreating] = useState(false);

  // Fetch stats and keys
  useEffect(() => {
    axios.get(`${API}/dashboard/stats`)
      .then(r => setStats(r.data))
      .catch(() => {});
    
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const { data } = await axios.get(`${API}/ai/keys`);
      setAiKeys(data.keys || []);
    } catch (err) {
      console.error("Failed to fetch keys");
    }
  };

  const handleSaveAIKey = async (e) => {
    e.preventDefault();
    if (!newKey.key || newKey.key.length < 20) {
      return toast.error("Please enter a valid OpenAI API key");
    }
    setSavingKey(true);
    try {
      await axios.post(`${API}/ai/keys`, { apiKey: newKey.key, label: newKey.label });
      setNewKey({ key: "", label: "" });
      toast.success("AI API Key added to pool!");
      fetchKeys();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add API key");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteAIKey = async (id) => {
    if (!window.confirm("Remove this key from the pool?")) return;
    try {
      await axios.delete(`${API}/ai/keys/${id}`);
      toast.success("Key removed");
      fetchKeys();
    } catch (err) {
      toast.error("Failed to remove API key");
    }
  };

  // Socket: active members (keep existing logic)
  useEffect(() => {
    if (!socket || !user) return;
    setActiveMembers([{ socketId: "self", username: user.username, userId: user._id, cursorColor: user.cursorColor || "#2F2FE4", joinedAt: Date.now() }]);
    socket.emit("join_room", "global_dashboard");
    socket.emit("get_room_users", "global_dashboard");
    const normalise = (d) => ({ socketId: d.socketId || d.id || d.socket_id || Math.random().toString(36).slice(2), username: d.username || d.name || d.user || "Unknown", userId: d.userId || d._id, cursorColor: d.cursorColor || "#2F2FE4", joinedAt: d.joinedAt || Date.now() });
    socket.on("room_users", (users) => { if (!Array.isArray(users)) return; const others = users.map(normalise).filter(u => u.username !== user.username); setActiveMembers(prev => { const self = prev.find(u => u.socketId === "self"); return self ? [self, ...others] : others; }); });
    socket.on("user_joined", (data) => { const m = normalise(data); if (m.username === user.username) return; setActiveMembers(prev => prev.find(u => u.username === m.username) ? prev : [...prev, m]); });
    socket.on("user_left", ({ socketId, username }) => { setActiveMembers(prev => prev.filter(u => u.socketId === "self" || (socketId ? u.socketId !== socketId : u.username !== username))); });
    return () => { socket.off("room_users"); socket.off("user_joined"); socket.off("user_left"); };
  }, [socket, user]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(newProject);
      setShowCreate(false);
      setNewProject({ name: "", description: "", language: "javascript", isPublic: false });
      toast.success("Project created successfully!");
      navigate(`/editor/${project._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create project");
    } finally { setCreating(false); }
  };

  const handleDeleteProject = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        await deleteProject(id);
        toast.success("Project deleted");
      } catch (err) {
        toast.error("Failed to delete project");
      }
    }
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()));

  const TABS = [
    { id: "projects", label: "Projects", icon: "📁" },
    { id: "members", label: "Active Team", icon: "👥" },
    { id: "stats", label: "Stats", icon: "📊" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center"><span className="text-white font-black text-xs">CB</span></div>
            <span className="font-black text-lg tracking-tight">CodeBloc</span>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full"><span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" /></span><span className="text-[10px] font-black text-green-400 uppercase tracking-wider">{globalCount} Online</span></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 p-1 pr-3 rounded-xl hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800"><img src={`https://ui-avatars.com/api/?name=${user?.username}&background=2563eb&color=fff&size=32`} className="w-8 h-8 rounded-lg" alt="avatar" /><span className="hidden md:block font-semibold text-white text-sm">{user?.username}</span><span className="text-[10px] text-slate-500">▼</span></button>
              <AnimatePresence>{isMenuOpen && (<><div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} /><motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-12 right-0 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 overflow-hidden z-50"><div className="px-4 py-2 border-b border-slate-800 mb-1"><p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Signed in as</p><p className="text-sm font-bold truncate">{user?.username}</p></div><button onClick={() => { setActiveTab("settings"); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2"><span>⚙️</span> Settings</button><button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"><span>🚪</span> Sign Out</button></motion.div></>)}</AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 sm:mb-10 text-center sm:text-left"><h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white mb-2">Hey, {user?.username} 👋</h1><p className="text-slate-400 text-base sm:text-lg">Your collaborative workspace — all in one place.</p></motion.div>
        
        <div className="flex gap-1 mb-6 sm:mb-8 p-1 bg-slate-900/60 border border-slate-800 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
          {TABS.map(t => (<button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:text-white"}`}><span>{t.icon}</span> {t.label}</button>))}
        </div>

        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm font-medium" /></div>
              <button onClick={() => setShowCreate(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm uppercase tracking-widest rounded-2xl transition shadow-xl shadow-blue-900/40 hover:scale-[1.02] sm:hover:scale-105 active:scale-100"><span className="text-lg">+</span> New Project</button>
            </div>
            {loading ? (<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">{[1,2,3].map(i => (<div key={i} className="h-48 sm:h-52 rounded-2xl bg-slate-900 animate-pulse border border-slate-800" />))}</div>) : filtered.length === 0 ? (<div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4"><div className="text-5xl sm:text-6xl mb-4">📁</div><p className="text-xl sm:text-2xl font-black text-slate-600 tracking-tighter uppercase tracking-widest">No projects found</p><p className="text-slate-600 mt-2 mb-6 text-sm">Create your first project to start collaborating</p><button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-blue-600 text-white font-black text-xs rounded-2xl hover:bg-blue-500 transition uppercase tracking-widest">Create Project</button></div>) : (<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">{filtered.map((project, i) => (<motion.div key={project._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4 }} className="group relative p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition-all hover:border-slate-700 hover:shadow-2xl hover:shadow-slate-900" onClick={() => navigate(`/editor/${project._id}`)}><div className="flex items-start justify-between mb-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white" style={{ backgroundColor: LANG_COLORS[project.language] || "#475569" }}>{project.language?.charAt(0).toUpperCase()}</div><div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition"><button onClick={e => handleDeleteProject(e, project._id)} className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition" title="Delete Project">🗑</button></div></div><h3 className="font-black text-white text-base sm:text-lg tracking-tight mb-1 truncate">{project.name}</h3><p className="text-slate-500 text-xs sm:text-sm mb-4 line-clamp-2">{project.description || "No description provided"}</p><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: (LANG_COLORS[project.language] || "#475569") + "22", color: LANG_COLORS[project.language] || "#94a3b8" }}>{project.language}</span>{project.isPublic && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-green-500/10 text-green-400">Public</span>}</div><span className="text-[9px] text-slate-600 font-mono">{new Date(project.updatedAt).toLocaleDateString()}</span></div></motion.div>))}</div>)}
          </div>
        )}

        {/* ── SETTINGS TAB ────────────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="p-6 sm:p-8 rounded-3xl border border-slate-800 bg-slate-900/60 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-3xl border border-purple-500/20">🤖</div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">AI Key Pool</h3>
                  <p className="text-slate-500 text-sm font-medium">Add multiple keys to increase quota and prevent rate limits.</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* Add Key Form */}
                <form onSubmit={handleSaveAIKey} className="space-y-4 p-6 rounded-2xl bg-slate-950/50 border border-slate-800">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Add New Key</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={newKey.label}
                      onChange={(e) => setNewKey(n => ({ ...n, label: e.target.value }))}
                      placeholder="Label (e.g. Personal, Work, Trial)"
                      className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 text-sm font-medium"
                    />
                    <input
                      type="password"
                      value={newKey.key}
                      onChange={(e) => setNewKey(n => ({ ...n, key: e.target.value }))}
                      placeholder="OpenAI API Key (sk-...)"
                      className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 text-sm font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingKey}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition shadow-lg shadow-purple-900/40"
                  >
                    {savingKey ? "Adding..." : "Add to Pool"}
                  </button>
                </form>

                {/* Keys List */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between items-center">
                    <span>Active Pool ({aiKeys.length} keys)</span>
                    <span className="text-purple-400">Rotation: Random</span>
                  </p>
                  
                  {aiKeys.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-2xl">
                      <p className="text-slate-600 text-sm">No keys in pool. Add one above to start.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {aiKeys.map(k => (
                        <div key={k._id} className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-800 rounded-2xl group hover:border-slate-700 transition">
                          <div className="flex items-center gap-4">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            <div>
                              <p className="text-sm font-bold text-white leading-none mb-1">{k.label}</p>
                              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">•••• •••• •••• {k.last4}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteAIKey(k._id)}
                            className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition"
                          >
                            🗑
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                  <h4 className="text-xs font-bold text-blue-400 mb-1">How rotation works</h4>
                  <p className="text-[10px] text-blue-300/60 leading-relaxed">
                    The platform picks a random key from your pool for every request (Chat or Code Completion). This helps distribute usage across multiple accounts and reduces the risk of hitting Rate Limits.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-6 sm:mb-8"><h2 className="text-2xl font-black text-white tracking-tight">New Project</h2><button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white text-xl transition">✕</button></div>
              <form onSubmit={handleCreateProject} className="space-y-4 sm:space-y-5">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Name *</label><input type="text" value={newProject.name} onChange={e => setNewProject(n => ({ ...n, name: e.target.value }))} placeholder="my-awesome-project" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-medium text-sm" required /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</label><textarea value={newProject.description} onChange={e => setNewProject(n => ({ ...n, description: e.target.value }))} placeholder="What are you building?" rows={3} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-medium resize-none text-sm" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Language</label><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{LANGUAGES.map(lang => (<button key={lang} type="button" onClick={() => setNewProject(n => ({ ...n, language: lang }))} className={`px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition truncate ${newProject.language === lang ? "bg-blue-600 text-white border border-blue-500" : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600"}`}>{lang}</button>))}</div></div>
                <div className="flex items-center gap-3"><button type="button" onClick={() => setNewProject(n => ({ ...n, isPublic: !n.isPublic }))} className={`relative w-10 h-5 rounded-full transition-colors ${newProject.isPublic ? "bg-blue-600" : "bg-slate-700"}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${newProject.isPublic ? "left-5.5" : "left-0.5"}`} /></button><span className="text-xs font-semibold text-slate-300">Public project</span></div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="w-full sm:flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition text-[10px] uppercase tracking-widest order-2 sm:order-1">Cancel</button><button type="submit" disabled={creating} className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl transition text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/40 order-1 sm:order-2">{creating ? "Creating..." : "Create Project"}</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
