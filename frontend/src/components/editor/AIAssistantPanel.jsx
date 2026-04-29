import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function AIAssistantPanel({ projectId, activeFile, content: editorContent }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "I am your AI Build Agent. I can help you create files and write code automatically. Try asking: 'Build a simple greeting function in hello.js'" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    let contextualInput = input;
    if (activeFile && editorContent) {
      contextualInput = `[CONTEXT: active file is ${activeFile.path || activeFile.name}, current content length is ${editorContent.length}]\n\n${input}\n\n[FILE_CONTENT_START]\n${editorContent}\n[FILE_CONTENT_END]`;
    }

    const userMsg = { role: "user", content: input }; // Keep display clean
    const aiMsg = { role: "user", content: contextualInput }; // Send context to AI

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/ai/chat`, {
        messages: [...messages, aiMsg],
        projectId
      });
      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err) {
      toast.error("AI Assistant error");
    } finally {
      setLoading(false);
    }
  };

  const executeBuild = async (path, content) => {
    try {
      const normalizedPath = path.trim().startsWith("/") ? path.trim() : "/" + path.trim();
      toast.loading(`Building ${normalizedPath}...`, { id: "ai-build" });
      await axios.post(`${API}/ai/action`, {
        projectId,
        action: "build_file",
        path: normalizedPath,
        content: content.trim()
      });
      toast.success(`Built ${normalizedPath} successfully!`, { id: "ai-build" });
      setMessages(prev => [...prev, { role: "assistant", content: `✅ Build Complete: ${normalizedPath}` }]);
    } catch (err) {
      toast.error("Build failed", { id: "ai-build" });
    }
  };

  const renderMessage = (m) => {
    // Very robust regex for: [BUILD_FILE:path] ... ```lang code ```
    const buildRegex = /\[BUILD_FILE:(.*?)\][\s\S]*?```[a-z]*\s*\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = buildRegex.exec(m.content)) !== null) {
      // Text before the build block
      if (match.index > lastIndex) {
        parts.push(<p key={`text-${lastIndex}`} className="whitespace-pre-wrap mb-2">{m.content.substring(lastIndex, match.index)}</p>);
      }
      
      const [fullMatch, path, code] = match;
      parts.push(
        <div key={`build-${match.index}`} className="my-4 p-4 bg-slate-950 rounded-2xl border border-blue-500/30 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[10px] text-blue-400">📄</span>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest truncate font-mono">{path.trim()}</span>
            </div>
            <button
              onClick={() => executeBuild(path, code)}
              className="shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition shadow-lg shadow-blue-900/40"
            >
              🚀 Build Now
            </button>
          </div>
          <div className="relative group">
             <pre className="text-[10px] bg-black/40 p-3 rounded-xl overflow-x-auto text-slate-400 max-h-48 border border-slate-800/50 custom-scrollbar">{code.trim()}</pre>
          </div>
        </div>
      );
      lastIndex = buildRegex.lastIndex;
    }

    // Remaining text
    if (lastIndex < m.content.length) {
      parts.push(<p key={`text-end`} className="whitespace-pre-wrap">{m.content.substring(lastIndex)}</p>);
    }

    return (
      <div className={`p-4 rounded-2xl text-xs leading-relaxed shadow-xl border ${
        m.role === "user" 
          ? "bg-blue-600/10 border-blue-500/20 text-blue-100 ml-8" 
          : "bg-slate-800/50 border-slate-700/50 text-slate-200 mr-8"
      }`}>
        {parts.length > 0 ? parts : m.content}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">AI Build Agent</span>
        </div>
        <button onClick={() => setMessages([])} className="text-[10px] font-black text-slate-500 hover:text-white transition uppercase tracking-tighter">Clear Chat</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {messages.map((m, i) => <div key={i}>{renderMessage(m)}</div>)}
        {loading && (
          <div className="flex items-center gap-3 p-4 bg-slate-800/30 rounded-2xl mr-8 border border-slate-700/30">
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agent is writing...</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur shrink-0">
        <div className="relative group">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what to build..."
            className="w-full pl-4 pr-12 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner group-hover:border-slate-700"
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()} 
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl flex items-center justify-center text-white transition-all shadow-lg shadow-blue-900/40 active:scale-95"
          >
            <span className="text-xl">✦</span>
          </button>
        </div>
        <p className="mt-2 text-[8px] text-center text-slate-600 font-bold uppercase tracking-tighter">AI can create files and write code automatically</p>
      </form>
    </div>
  );
}
