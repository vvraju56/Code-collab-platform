import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-16 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #080d1a 0%, #0d1b3e 60%, #0a1628 100%)" }}>
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">CB</span>
            </div>
            <span className="text-white font-black text-xl tracking-tight">CodeBloc</span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <h1 className="text-6xl font-black text-white leading-none tracking-tighter">
            Code Together.<br />
            <span className="text-blue-400">Ship Faster.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md leading-relaxed">
            Real-time collaborative coding. Multiple cursors, live chat, version control, and a built-in execution sandbox — all in one platform.
          </p>
          <div className="flex gap-6">
            {[
              { icon: "⚡", label: "Live Sync" },
              { icon: "🔒", label: "Version Control" },
              { icon: "▶", label: "Run Code" },
              { icon: "💬", label: "Team Chat" }
            ].map(f => (
              <div key={f.label} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                  {f.icon}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-slate-600 text-sm font-medium">
          © 2025 CodeBloc Platform
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">CB</span>
            </div>
            <span className="text-white font-black text-xl">CodeBloc</span>
          </div>

          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-slate-400 mb-8">
            {mode === "login" ? "Sign in to your workspace" : "Join the collaboration platform"}
          </p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-medium"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Username</label>
                <input
                  type="text"
                  placeholder="yourhandle"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full px-5 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-white font-medium placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-5 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-white font-medium placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-5 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-white font-medium placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-900/50 hover:shadow-blue-800/50 hover:scale-[1.01] active:scale-[0.99] mt-2"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-slate-500 mt-8 text-sm">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); }}
              className="text-blue-400 font-bold hover:text-blue-300 transition"
            >
              {mode === "login" ? "Sign up free" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
