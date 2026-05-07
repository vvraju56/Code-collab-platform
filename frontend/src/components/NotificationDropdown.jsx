import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "../context/NotificationContext";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const getIcon = (type) => {
    switch (type) {
      case "friend_request": return "👤";
      case "join_request": return "📥";
      case "project_invite": return "📁";
      case "incoming_call": return "📞";
      default: return "🔔";
    }
  };

  const handleAcceptFriend = async (from, requestId) => {
    try {
      const userId = from?._id || from;
      await axios.post(`${API}/users/friends/${userId}/accept`);
      removeNotification(requestId);
    } catch (err) { console.error(err); }
  };

  const handleRejectFriend = async (from, requestId) => {
    try {
      const userId = from?._id || from;
      await axios.post(`${API}/users/friends/${userId}/reject`);
      removeNotification(requestId);
    } catch (err) { console.error(err); }
  };

  const handleAcceptInvite = async (inviteId, notifId) => {
    try {
      const res = await axios.post(`${API}/projects/invitations/${inviteId}/accept`);
      removeNotification(notifId);
      if (res.data.project) {
        navigate(`/editor/${res.data.project._id}`);
      }
    } catch (err) { console.error(err); }
  };

  const handleRejectInvite = async (inviteId, notifId) => {
    try {
      await axios.post(`${API}/projects/invitations/${inviteId}/reject`);
      removeNotification(notifId);
    } catch (err) { console.error(err); }
  };

  const formatTime = (time) => {
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition text-slate-400 hover:text-white"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-12 right-0 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[80vh]"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <span className="text-sm font-black text-white uppercase tracking-wider">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold">Mark all read</button>
                )}
              </div>

              <div className="overflow-y-auto max-h-96 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">No notifications</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition ${!n.read ? "bg-slate-800/20" : ""}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{getIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{n.title}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                          <p className="text-[8px] text-slate-600 mt-1">{formatTime(n.time)}</p>
                          
                          {n.type === "friend_request" && n.from && (
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleAcceptFriend(n.from, n.id)} className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-[8px] font-bold rounded">Accept</button>
                              <button onClick={() => handleRejectFriend(n.from, n.id)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 text-[8px] font-bold rounded">Reject</button>
                            </div>
                          )}
                          
                          {n.type === "project_invite" && n.projectId && (
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleAcceptInvite(n.id.replace('invite-', ''), n.id)} className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-[8px] font-bold rounded">Accept</button>
                              <button onClick={() => handleRejectInvite(n.id.replace('invite-', ''), n.id)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 text-[8px] font-bold rounded">Reject</button>
                            </div>
                          )}
                          
                          {n.type === "join_request" && n.projectId && (
                            <button onClick={() => navigate(`/editor/${n.projectId}`)} className="mt-2 px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white text-[8px] font-bold rounded">View Request</button>
                          )}
                        </div>
                        <button onClick={() => removeNotification(n.id)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}