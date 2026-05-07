import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function VersionPanel({ projectId, activeFile }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [reverting, setReverting] = useState(null);
  const [commitError, setCommitError] = useState(null);

  const loadVersions = useCallback(async () => {
    if (!activeFile) {
      console.log('VersionPanel: No activeFile');
      return;
    }
    console.log('VersionPanel: Loading versions for file:', activeFile._id, activeFile.name);
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/versions/file/${activeFile._id}`);
      setVersions(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeFile]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const handleCommit = async (e) => {
    e.preventDefault();
    if (!commitMsg.trim() || !activeFile) return;
    setCommitting(true);
    setCommitError(null);
    try {
      console.log('Committing file:', activeFile._id, 'message:', commitMsg);
      const { data } = await axios.post(`${API}/versions/commit`, {
        fileId: activeFile._id,
        commitMessage: commitMsg.trim()
      });
      console.log('Commit successful:', data);
      setCommitMsg("");
      await loadVersions();
    } catch (err) {
      console.error('Commit error:', err);
      const errorMsg = err.response?.data?.error || err.message || "Commit failed";
      setCommitError(errorMsg);
    } finally { setCommitting(false); }
  };

  const handleRevert = async (versionId) => {
    if (!confirm("Revert file to this version? Current changes will be replaced.")) return;
    setReverting(versionId);
    try {
      await axios.post(`${API}/versions/${versionId}/revert`);
      alert("File reverted successfully. Reload to see changes.");
    } catch (err) {
      alert(err.response?.data?.error || "Revert failed");
    } finally { setReverting(null); }
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
        <span className="text-sm">🔖</span>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Version Control</span>
      </div>

      {/* Commit form */}
      <div className="px-3 py-3 border-b border-slate-800">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
          {activeFile ? `Commit: ${activeFile.name}` : "Select a file"}
        </p>
<form onSubmit={handleCommit} className="space-y-2">
            {commitError && (
              <div className="text-[10px] text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                {commitError}
              </div>
            )}
            <input
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              placeholder="Commit message..."
              disabled={!activeFile}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-40"
            />
            <button
            type="submit"
            disabled={!commitMsg.trim() || !activeFile || committing}
            className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest rounded-xl transition"
          >
            {committing ? "Committing..." : "⬆ Commit Snapshot"}
          </button>
        </form>
      </div>

      {/* Commit log */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {!activeFile ? (
          <p className="text-center text-xs text-slate-700 py-8">Open a file to see history</p>
        ) : loading ? (
          <div className="space-y-2 px-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse" />)}
          </div>
        ) : versions.length === 0 ? (
          <p className="text-center text-xs text-slate-700 py-8">No commits yet</p>
        ) : (
          <div className="px-3 space-y-2">
            {versions.map((v, i) => (
              <div key={v._id}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{v.commitMessage}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        #{v.commitHash}
                      </span>
                      {i === 0 && (
                        <span className="text-[9px] font-black bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded uppercase">
                          HEAD
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevert(v._id)}
                    disabled={reverting === v._id || i === 0}
                    className="shrink-0 opacity-0 group-hover:opacity-100 px-2 py-1 text-[9px] font-black bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 rounded-lg uppercase tracking-wider transition"
                  >
                    {reverting === v._id ? "..." : "Revert"}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                      style={{ backgroundColor: v.author?.cursorColor || "#3b82f6" }}
                    >
                      {v.author?.username?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{v.author?.username}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono">
                    <span className="text-green-400">+{v.linesAdded}</span>
                    <span className="text-red-400">-{v.linesRemoved}</span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-600 mt-1 font-mono">{formatDate(v.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
