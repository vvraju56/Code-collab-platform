import { useState, useEffect, useRef } from "react";

export default function ChatPanel({ socket, projectId, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit("get_chat_history", { projectId });

    socket.on("chat_history", (history) => setMessages(history));
    socket.on("new_message", (msg) => setMessages(prev => [...prev, msg]));
    socket.on("user_typing", ({ username }) => {
      setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);
    });
    socket.on("user_stopped_typing", ({ username }) => {
      setTypingUsers(prev => prev.filter(u => u !== username));
    });

    return () => {
      socket.off("chat_history");
      socket.off("new_message");
      socket.off("user_typing");
      socket.off("user_stopped_typing");
    };
  }, [socket, projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit("send_message", { projectId, message: input.trim(), type: "text" });
    socket.emit("typing_stop", { projectId });
    setInput("");
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    if (!socket) return;
    socket.emit("typing_start", { projectId });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("typing_stop", { projectId });
    }, 1500);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
        <span className="text-sm">💬</span>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Team Chat</span>
        <span className="ml-auto text-[9px] font-bold text-slate-600">{messages.length} msgs</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-xs font-bold text-slate-600">No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isSelf = msg.sender?.username === user?.username || msg.sender?._id === user?._id;
          const isSystem = msg.type === "system";
          const showAvatar = i === 0 || messages[i-1]?.sender?.username !== msg.sender?.username;

          if (isSystem) return (
            <div key={msg._id || i} className="text-center">
              <span className="text-[10px] font-bold text-slate-600 bg-slate-900 px-3 py-1 rounded-full">{msg.message}</span>
            </div>
          );

          return (
            <div key={msg._id || i} className={`flex gap-2 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
              {!isSelf && showAvatar ? (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 mt-auto"
                  style={{ backgroundColor: msg.sender?.cursorColor || "#3b82f6" }}
                >
                  {msg.sender?.username?.charAt(0).toUpperCase()}
                </div>
              ) : !isSelf ? <div className="w-7 shrink-0" /> : null}

              <div className={`max-w-[80%] ${isSelf ? "items-end" : "items-start"} flex flex-col gap-1`}>
                {!isSelf && showAvatar && (
                  <span className="text-[10px] font-black text-slate-500 px-1">{msg.sender?.username}</span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm font-medium leading-relaxed break-words ${
                    isSelf
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-slate-800 text-slate-200 rounded-bl-md"
                  }`}
                >
                  {msg.message}
                </div>
                <span className="text-[9px] text-slate-600 px-1">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500"
                  style={{ animation: `bounce 0.8s ease-in-out ${i*0.15}s infinite` }} />
              ))}
            </div>
            <span className="text-[10px] font-bold">{typingUsers.join(", ")} typing...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-3 pb-3 pt-2 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleTyping}
            placeholder="Send a message..."
            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 font-medium"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition font-black text-sm"
          >→</button>
        </div>
      </form>

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)} }`}</style>
    </div>
  );
}
