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

  const [activeTab, setActiveTab] = useState("projects");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [activeMembers, setActiveMembers] = useState([]);
  const [stats, setStats] = useState({ totalProjects: 0, totalUsers: 0, totalCommits: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // New project form
  const [newProject, setNewProject] = useState({ name: "", description: "", language: "javascript", isPublic: false });
  const [creating, setCreating] = useState(false);

  // Fetch stats
  useEffect(() => {
    axios.get(`${API}/dashboard/stats`)
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  // Socket: active members
  useEffect(() => {
    if (!socket || !user) return;

    setActiveMembers([{
      socketId: "self",
      username: user.username,
      userId: user._id,
      cursorColor: user.cursorColor || "#2F2FE4",
      joinedAt: Date.now()
    }]);

    socket.emit("join_room", "global_dashboard");
    socket.emit("get_room_users", "global_dashboard");

    const normalise = (d) => ({
      socketId: d.socketId || d.id || d.socket_id || Math.random().toString(36).slice(2),
      username: d.username || d.name || d.user || "Unknown",
      userId: d.userId || d._id,
      cursorColor: d.cursorColor || "#2F2FE4",
      joinedAt: d.joinedAt || Date.now()
    });

    socket.on("room_users", (users) => {
      if (!Array.isArray(users)) return;
      const others = users.map(normalise).filter(u => u.username !== user.username);
      setActiveMembers(prev => {
        const self = prev.find(u => u.socketId === "self");
        return self ? [self, ...others] : others;
      });
    });

    socket.on("user_joined", (data) => {
      const m = normalise(data);
      if (m.username === user.username) return;
      setActiveMembers(prev => prev.find(u => u.username === m.username) ? prev : [...prev, m]);
    });

    socket.on("user_left", ({ socketId, username }) => {
      setActiveMembers(prev => prev.filter(u =>
        u.socketId === "self" || (socketId ? u.socketId !== socketId : u.username !== username)
      ));
    });

    return () => {
      socket.off("room_users");
      socket.off("user_joined");
      socket.off("user_left");
    };
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

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: "projects", label: "Projects", icon: "📁" },
    { id: "members", label: "Active Team", icon: "👥" },
    { id: "stats", label: "Stats", icon: "📊" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-xs">CB</span>
            </div>
            <span className="font-black text-lg tracking-tight">CodeBloc</span>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              <span className="text-[10px] font-black text-green-400 uppercase tracking-wider">{globalCount} Online</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 p-1 pr-3 rounded-xl hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800"
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${user?.username}&background=2563eb&color=fff&size=32`}
                  className="w-8 h-8 rounded-lg"
                  alt="avatar"
                />
                <span className="hidden md:block font-semibold text-white text-sm">{user?.username}</span>
                <span className="text-[10px] text-slate-500">▼</span>
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-12 right-0 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 overflow-hidden z-50"
                    >
                      <div className="px-4 py-2 border-b border-slate-800 mb-1">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Signed in as</p>
                        <p className="text-sm font-bold truncate">{user?.username}</p>
                      </div>
                      <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <span>🚪</span> Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ── GREETING ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 sm:mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white mb-2">
            Hey, {user?.username} 👋
          </h1>
          <p className="text-slate-400 text-base sm:text-lg">Your collaborative workspace — all in one place.</p>
        </motion.div>

        {/* ── STAT CARDS ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
          {[
            { label: "Projects", value: stats.totalProjects || projects.length, icon: "📁", color: "blue" },
            { label: "Live Users", value: globalCount, icon: "🟢", color: "green" },
            { label: "Commits", value: stats.totalCommits, icon: "🔖", color: "purple" },
            { label: "Team Members", value: stats.totalUsers, icon: "👥", color: "amber" }
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col items-center sm:items-start"
            >
              <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{s.icon}</div>
              <p className="text-2xl sm:text-3xl font-black text-white tracking-tighter">{s.value}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── TABS ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 sm:mb-8 p-1 bg-slate-900/60 border border-slate-800 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ── PROJECTS TAB ───────────────────────────────────────────────────── */}
        {activeTab === "projects" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-sm font-medium"
                />
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm uppercase tracking-widest rounded-2xl transition shadow-xl shadow-blue-900/40 hover:scale-[1.02] sm:hover:scale-105 active:scale-100"
              >
                <span className="text-lg">+</span> New Project
              </button>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {[1,2,3].map(i => (
                  <div key={i} className="h-48 sm:h-52 rounded-2xl bg-slate-900 animate-pulse border border-slate-800" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
                <div className="text-5xl sm:text-6xl mb-4">📁</div>
                <p className="text-xl sm:text-2xl font-black text-slate-600 tracking-tighter uppercase tracking-widest">No projects found</p>
                <p className="text-slate-600 mt-2 mb-6 text-sm">Create your first project to start collaborating</p>
                <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-blue-600 text-white font-black text-xs rounded-2xl hover:bg-blue-500 transition uppercase tracking-widest">
                  Create Project
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {filtered.map((project, i) => (
                  <motion.div
                    key={project._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -4 }}
                    className="group relative p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition-all hover:border-slate-700 hover:shadow-2xl hover:shadow-slate-900"
                    onClick={() => navigate(`/editor/${project._id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white"
                        style={{ backgroundColor: LANG_COLORS[project.language] || "#475569" }}
                      >
                        {project.language?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition">
                        <button
                          onClick={e => handleDeleteProject(e, project._id)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition"
                          title="Delete Project"
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    <h3 className="font-black text-white text-base sm:text-lg tracking-tight mb-1 truncate">{project.name}</h3>
                    <p className="text-slate-500 text-xs sm:text-sm mb-4 line-clamp-2">{project.description || "No description provided"}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: (LANG_COLORS[project.language] || "#475569") + "22", color: LANG_COLORS[project.language] || "#94a3b8" }}
                        >
                          {project.language}
                        </span>
                        {project.isPublic && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-green-500/10 text-green-400">Public</span>}
                      </div>
                      <span className="text-[9px] text-slate-600 font-mono">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {project.collaborators?.length > 0 && (
                      <div className="flex -space-x-1.5 mt-4">
                        {project.collaborators.slice(0, 5).map(c => (
                          <img
                            key={c.user?._id}
                            src={`https://ui-avatars.com/api/?name=${c.user?.username}&background=334155&color=fff&size=24`}
                            className="w-6 h-6 rounded-full border-2 border-slate-900"
                            title={c.user?.username}
                            alt=""
                          />
                        ))}
                        {project.collaborators.length > 5 && (
                          <span className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[9px] font-black text-slate-300">
                            +{project.collaborators.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE TEAM TAB ────────────────────────────────────────────────── */}
        {activeTab === "members" && (
          <div className="space-y-6">
            <div
              className="relative rounded-3xl overflow-hidden p-6 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6"
              style={{ background: "linear-gradient(135deg, #080616 0%, #0f0a2e 60%, #1a0a3e 100%)" }}
            >
              <div className="absolute top-0 left-1/3 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-[10px] font-black text-green-400 uppercase tracking-[0.3em]">Live Node Network</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tighter mb-1">Active Team</h2>
                <p className="text-slate-400 text-sm">{activeMembers.length} developer{activeMembers.length !== 1 ? "s" : ""} connected.</p>
              </div>

              <div className="relative z-10 flex gap-4">
                {[
                  { label: "Online", value: activeMembers.length },
                  { label: "Total Nodes", value: globalCount || activeMembers.length }
                ].map(s => (
                  <div key={s.label} className="text-center px-6 sm:px-8 py-4 sm:py-5 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {activeMembers.map((member, i) => {
                const isSelf = member.socketId === "self" || member.username === user?.username;
                const COLORS = ["#2F2FE4","#7C3AED","#0891B2","#059669","#DC2626","#D97706"];
                const color = member.cursorColor || COLORS[member.username?.charCodeAt(0) % COLORS.length] || "#2F2FE4";

                return (
                  <motion.div
                    key={member.socketId || i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ y: -4 }}
                    className="relative rounded-2xl p-5 sm:p-6 overflow-hidden cursor-default group"
                    style={{
                      background: isSelf
                        ? "linear-gradient(135deg, #1e3a8a, #1d4ed8)"
                        : "linear-gradient(135deg, #0f172a, #1e293b)",
                      border: isSelf
                        ? "1px solid rgba(96,165,250,0.35)"
                        : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: isSelf ? "0 0 40px rgba(59,130,246,0.15)" : "none"
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                      style={{ background: `radial-gradient(circle at 50% 0%, ${color}18, transparent 70%)` }}
                    />

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-5">
                        <div
                          className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg"
                          style={{ background: isSelf ? "rgba(255,255,255,0.15)" : color }}
                        >
                          {member.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                        {isSelf && (
                          <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest"
                            style={{ background: "rgba(255,255,255,0.12)", color: "#bfdbfe" }}>
                            You
                          </span>
                        )}
                      </div>

                      <p className="font-black text-white text-base sm:text-lg uppercase tracking-tighter truncate leading-none mb-1">
                        {member.username || "Unknown"}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                        {isSelf ? "Active Session" : "Peer Node"}
                      </p>

                      <div
                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                        style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
                      >
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"
                            style={{ boxShadow: "0 0 8px rgba(34,197,94,0.8)" }} />
                        </span>
                        <span className="text-[9px] font-black text-green-400 uppercase tracking-[0.2em]">
                          Node Active
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STATS TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "stats" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/60">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-widest mb-6 text-white text-center sm:text-left">Your Activity</h3>
              <div className="space-y-5">
                {[
                  { label: "Projects Created", value: projects.filter(p => p.owner?._id === user?._id || p.owner === user?._id).length, max: Math.max(projects.length, 1), color: "#3B82F6" },
                  { label: "Commits Made", value: stats.totalCommits, max: Math.max(stats.totalCommits, 1), color: "#8B5CF6" },
                  { label: "Collaborations", value: projects.filter(p => p.collaborators?.some(c => c.user?._id === user?._id)).length, max: Math.max(projects.length, 1), color: "#10B981" }
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                      <span className="text-[10px] font-black text-white">{s.value}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((s.value / s.max) * 100, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl border border-blue-500/20 bg-blue-600/10 flex flex-col items-center sm:items-start">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-widest mb-2 text-white">Platform</h3>
              <p className="text-5xl sm:text-6xl font-black text-white tracking-tighter mb-2">{stats.totalUsers}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300/60">Registered Developers</p>
              <div className="mt-8 space-y-3 w-full">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Projects</span>
                  <span className="font-bold text-white">{projects.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Currently Online</span>
                  <span className="font-bold text-green-400">{globalCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── CREATE PROJECT MODAL ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={e => e.target === e.currentTarget && setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight">New Project</h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white text-xl transition">✕</button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={e => setNewProject(n => ({ ...n, name: e.target.value }))}
                    placeholder="my-awesome-project"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-medium text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea
                    value={newProject.description}
                    onChange={e => setNewProject(n => ({ ...n, description: e.target.value }))}
                    placeholder="What are you building?"
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-medium resize-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Language</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setNewProject(n => ({ ...n, language: lang }))}
                        className={`px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition truncate ${
                          newProject.language === lang
                            ? "bg-blue-600 text-white border border-blue-500"
                            : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewProject(n => ({ ...n, isPublic: !n.isPublic }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${newProject.isPublic ? "bg-blue-600" : "bg-slate-700"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${newProject.isPublic ? "left-5.5" : "left-0.5"}`} />
                  </button>
                  <span className="text-xs font-semibold text-slate-300">Public project</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="w-full sm:flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition text-[10px] uppercase tracking-widest order-2 sm:order-1">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating}
                    className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl transition text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/40 order-1 sm:order-2">
                    {creating ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
