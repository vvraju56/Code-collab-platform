import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FILE_ICONS = {
  js: "🟡", ts: "🔷", py: "🐍", java: "☕", cpp: "⚙️", c: "⚙️",
  go: "🐹", rs: "🦀", html: "🌐", css: "🎨", md: "📝", json: "📋",
  sh: "💻", php: "🐘", rb: "💎", txt: "📄"
};

function getIcon(filename, isDir) {
  if (isDir) return "📂";
  const ext = filename?.split(".").pop()?.toLowerCase();
  return FILE_ICONS[ext] || "📄";
}

export default function FileTree({ files, activeFile, onOpenFile, onCreateFile, onDeleteFile }) {
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    onCreateFile(newFileName.trim());
    setNewFileName("");
    setShowNewFile(false);
  };

  const rootFiles = files.filter(f => f.parentPath === "/" || !f.parentPath);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Explorer</span>
        <button
          onClick={() => setShowNewFile(v => !v)}
          title="New File"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition text-sm"
        >+</button>
      </div>

      {/* New file input */}
      <AnimatePresence>
        {showNewFile && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleCreate}
            className="overflow-hidden border-b border-slate-800"
          >
            <input
              autoFocus
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => e.key === "Escape" && setShowNewFile(false)}
              placeholder="filename.js"
              className="w-full px-4 py-2.5 bg-slate-800 text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </motion.form>
        )}
      </AnimatePresence>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
        {rootFiles.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-slate-600">No files yet</p>
            <button onClick={() => setShowNewFile(true)} className="mt-2 text-xs text-blue-400 hover:text-blue-300">+ Create file</button>
          </div>
        ) : (
          rootFiles.map(file => (
            <div
              key={file._id}
              onClick={() => !file.isDirectory && onOpenFile(file)}
              className={`group flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors ${
                activeFile?._id === file._id
                  ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-sm shrink-0">{getIcon(file.name, file.isDirectory)}</span>
              <span className="text-sm font-mono truncate flex-1">{file.name}</span>
              {confirmDelete === file._id ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteFile(file._id); setConfirmDelete(null); }}
                    className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded"
                  >DEL</button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                    className="px-1.5 py-0.5 text-[9px] font-black bg-slate-600 text-white rounded"
                  >NO</button>
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelete(file._id); }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition text-xs"
                >🗑</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
