import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function AIAssistantPanel({ activeFile, content }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Check if user has AI key
    axios.get(`${API}/auth/me`)
      .then(r => setHasKey(!!r.data.user.openai?.last4))
      .catch(() => setHasKey(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Include current file context
      const context = activeFile 
        ? `\n\n[Current File: ${activeFile.path}]\n\`\`\`${activeFile.language}\n${content}\n\`\`\``
        : "";

      const { data } = await axios.post(`${API}/ai/chat`, {
        messages: [...messages, { ...userMsg, content: userMsg.content + context }]
      });

      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err) {
      toast.error(err.response?.data?.error || "AI failed to respond");
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-4xl mb-4">🔑</div>
        <h3 className="text-white font-bold mb-2">AI Key Required</h3>
        <p className="text-slate-400 text-sm mb-6">
          Please set your OpenAI API key in the settings to use the AI assistant.
        </p>
        <button 
          onClick={() => window.open("/dashboard", "_blank")}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
        >
          Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Assistant</span>
        <button 
          onClick={() => setMessages([])}
          className="text-[10px] text-slate-500 hover:text-white"
        >
          Clear
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="text-3xl mb-2 opacity-20">✦</div>
            <p className="text-slate-500 text-xs italic">
              Ask me to explain code, fix bugs, or generate new features.
            </p>
          </div>
        )}
        
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-300 rounded-tl-none border border-slate-700'
            }`}>
              <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask AI about your code..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
          />
          <button 
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50"
          >
            ✦
          </button>
        </div>
      </form>
    </div>
  );
}
