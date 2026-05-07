import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useProjects } from "../hooks/useProjects";
import NotificationDropdown from "../components/NotificationDropdown";
import axios from "axios";
import { toast } from "react-hot-toast";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const LANGUAGES = ["java", "python", "react", "c", "csharp", "javascript"];
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
    const newPath = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState(null, "", newPath);
  }, [activeTab]);

  // AI Settings state
  const [aiKeys, setAiKeys] = useState([]);
  const [newKey, setNewKey] = useState({ key: "", label: "" });
  const [savingKey, setSavingKey] = useState(false);

  // New project form
  const [newProject, setNewProject] = useState({ name: "", description: "", language: "java", isPublic: true });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    axios.get(`${API}/dashboard/stats`).then(r => setStats(r.data)).catch(() => {});
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const { data } = await axios.get(`${API}/ai/keys`);
      setAiKeys(data.keys || []);
    } catch (err) {}
  };

  const handleSaveAIKey = async (e) => {
    e.preventDefault();
    if (!newKey.key || newKey.key.length < 20) return toast.error("Invalid key");
    setSavingKey(true);
    try {
      await axios.post(`${API}/ai/keys`, { apiKey: newKey.key, label: newKey.label });
      setNewKey({ key: "", label: "" });
      toast.success("Added to pool");
      fetchKeys();
    } catch (err) {
      toast.error("Failed to add key");
    } finally { setSavingKey(false); }
  };

  const handleDeleteAIKey = async (id) => {
    if (!window.confirm("Remove key?")) return;
    try {
      await axios.delete(`${API}/ai/keys/${id}`);
      toast.success("Removed");
      fetchKeys();
    } catch (err) {}
  };

  // Socket logic
  useEffect(() => {
    if (!socket || !user) return;
    setActiveMembers([{ socketId: "self", username: user.username, userId: user._id, cursorColor: user.cursorColor || "#2F2FE4", joinedAt: Date.now() }]);
    socket.emit("join_room", "global_dashboard");
    socket.on("room_users", (users) => {
      const others = users.map(u => ({
        socketId: u.socketId || u.id,
        username: u.username,
        userId: u.userId,
        cursorColor: u.cursorColor || "#2F2FE4",
        joinedAt: u.joinedAt || Date.now()
      })).filter(u => u.username !== user.username);
      setActiveMembers(prev => [prev[0], ...others]);
    });
    socket.on("user_joined", (u) => {
      if (u.username === user.username) return;
      setActiveMembers(prev => [...prev.filter(p => p.username !== u.username), u]);
    });
    socket.on("user_left", ({ username }) => {
      setActiveMembers(prev => prev.filter(u => u.username !== username || u.socketId === "self"));
    });
    return () => { socket.off("room_users"); socket.off("user_joined"); socket.off("user_left"); };
  }, [socket, user]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const p = await createProject(newProject);
      setShowCreate(false);
      navigate(`/editor/${p._id}`);
    } catch (err) { 
      const msg = err.response?.data?.error || "Failed to create";
      toast.error(msg);
    }
    finally { setCreating(false); }
  };

  const TABS = [
    { id: "projects", label: "Projects", icon: "📁" },
    { id: "members", label: "Team", icon: "👥" },
    { id: "stats", label: "Stats", icon: "📊" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xs text-white">CB</div>
            <span className="font-black text-lg hidden sm:block">CodeBloc</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75"/><span className="h-1.5 w-1.5 rounded-full bg-green-500"/></span>
              <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">{globalCount} Live</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationDropdown />
            <button onClick={() => navigate("/search")} className="p-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-slate-400 hover:text-white" title="Search Users & Projects">🔍</button>
            <div className="relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 p-1 pr-3 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition">
              <img src={`https://ui-avatars.com/api/?name=${user?.username}&background=2563eb&color=fff&size=32`} className="w-8 h-8 rounded-lg" alt="" />
              <span className="text-[10px] text-slate-500">▼</span>
            </button>
            <AnimatePresence>{isMenuOpen && (<><div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}/><motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-12 right-0 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 overflow-hidden"><div className="px-4 py-2 border-b border-slate-800 mb-1"><p className="text-[9px] text-slate-500 uppercase font-black">Account</p><p className="text-sm font-bold truncate">{user?.username}</p></div><button onClick={() => { setActiveTab("settings"); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2 transition"><span>⚙️</span> Settings</button><button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition"><span>🚪</span> Sign Out</button></motion.div></>)}</AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white mb-2">Hey, {user?.username} 👋</h1>
          <p className="text-slate-400 text-sm sm:text-lg">Your collaborative workspace.</p>
        </motion.div>

        {/* Responsive Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Projects", value: stats.totalProjects || projects.length, icon: "📁", color: "blue" },
            { label: "Live", value: globalCount, icon: "🟢", color: "green" },
            { label: "Commits", value: stats.totalCommits || 0, icon: "🔖", color: "purple" },
            { label: "Users", value: stats.totalUsers || 0, icon: "👥", color: "amber" }
          ].map((s, i) => (
            <div key={i} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col items-center sm:items-start transition hover:border-slate-700">
              <span className="text-xl mb-1">{s.icon}</span>
              <span className="text-xl sm:text-2xl font-black text-white">{s.value}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-8 p-1 bg-slate-900/60 border border-slate-800 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
          {TABS.map(t => (<button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:text-white"}`}>{t.label}</button>))}
        </div>

        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm focus:border-blue-500 transition" />
              </div>
              <button onClick={() => setShowCreate(true)} className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition shadow-xl shadow-blue-900/40">+ New Project</button>
            </div>
            {loading ? (<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => (<div key={i} className="h-40 rounded-2xl bg-slate-900 animate-pulse border border-slate-800" />))}</div>) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((p, i) => (
                  <motion.div key={p._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => navigate(`/editor/${p._id}`)} className="group p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition border hover:border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white" style={{ backgroundColor: LANG_COLORS[p.language] || "#475569" }}>{p.language?.charAt(0).toUpperCase()}</div>
                      <button onClick={e => { e.stopPropagation(); deleteProject(p._id); }} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400 transition">🗑</button>
                    </div>
                    <h3 className="font-black text-white text-lg truncate mb-1">{p.name}</h3>
                    <p className="text-slate-500 text-xs line-clamp-2 h-8">{p.description || "No description"}</p>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-800/50">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-800 text-slate-400">{p.language}</span>
                      <span className="text-[10px] text-slate-600">{new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto">
            <div className="p-5 sm:p-8 rounded-3xl border border-slate-800 bg-slate-900/60 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-2xl border border-purple-500/20">🤖</div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">AI Key Pool</h3>
                  <p className="text-slate-500 text-xs sm:text-sm font-medium">Automatic rotation for multiple keys.</p>
                </div>
              </div>

              <div className="space-y-6">
                <form onSubmit={handleSaveAIKey} className="p-4 sm:p-6 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input type="text" value={newKey.label} onChange={e => setNewKey(n => ({ ...n, label: e.target.value }))} placeholder="Key Label (e.g. Trial)" className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:border-purple-500 transition" />
                    <input type="password" value={newKey.key} onChange={e => setNewKey(n => ({ ...n, key: e.target.value }))} placeholder="OpenAI Key (sk-...)" className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:border-purple-500 transition" />
                  </div>
                  <button type="submit" disabled={savingKey} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition shadow-lg shadow-purple-900/40">{savingKey ? "Adding..." : "Add to Pool"}</button>
                </form>

                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Keys ({aiKeys.length})</span>
                    <span className="text-[10px] font-black text-green-500 uppercase">Rotation Active</span>
                  </div>
                  {aiKeys.length === 0 ? (<div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 text-sm">No keys found.</div>) : (
                    <div className="space-y-2">
                      {aiKeys.map(k => (
                        <div key={k._id} className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-800 rounded-2xl hover:border-slate-700 transition">
                          <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${
                              k.provider === "groq" ? "bg-orange-500 shadow-orange-500/60" : 
                              k.provider === "gemini" ? "bg-blue-500 shadow-blue-500/60" :
                              "bg-green-500 shadow-green-500/60"
                            }`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-white leading-none">{k.label || "Untitled Key"}</p>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${
                                  k.provider === "groq" ? "bg-orange-500/10 border-orange-500/20 text-orange-500" : 
                                  k.provider === "gemini" ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                  "bg-green-500/10 border-green-500/20 text-green-500"
                                }`}>
                                  {k.provider}
                                </span>
                              </div>
                              <p className="text-[10px] font-mono text-slate-500 mt-1">•••• {k.last4}</p>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteAIKey(k._id)} className="p-2 text-slate-600 hover:text-red-400 transition">🗑</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Responsive Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-white uppercase tracking-tight">New Project</h2><button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white">✕</button></div>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <input value={newProject.name} onChange={e => setNewProject(n => ({ ...n, name: e.target.value }))} placeholder="Project Name" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white text-sm" required />
                <textarea value={newProject.description} onChange={e => setNewProject(n => ({ ...n, description: e.target.value }))} placeholder="Description" rows={3} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  {["javascript", "python", "html", "rust"].map(l => (
                    <button key={l} type="button" onClick={() => setNewProject(n => ({ ...n, language: l }))} className={`py-2 rounded-xl text-[10px] font-black uppercase transition ${newProject.language === l ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500"}`}>{l}</button>
                  ))}
                </div>
                <button type="submit" disabled={creating} className="w-full py-3.5 bg-blue-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest">{creating ? "Creating..." : "Launch Project"}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
