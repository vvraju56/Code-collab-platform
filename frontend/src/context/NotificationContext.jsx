import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [friendsRes, projectsRes, invitesRes] = await Promise.all([
        axios.get(`${API}/users/requests`),
        axios.get(`${API}/projects/join-requests`),
        axios.get(`${API}/projects/invitations`)
      ]);
      
      const notifs = [];
      
      // Friend requests
      (friendsRes.data || []).forEach(r => {
        notifs.push({
          id: `friend-${r._id}`,
          type: "friend_request",
          title: "Friend Request",
          message: `${r.from?.username || r.username} wants to be your friend`,
          from: r.from,
          time: r.createdAt,
          read: false
        });
      });
      
      // Join requests (for projects user owns)
      (projectsRes.data || []).forEach(p => {
        (p.joinRequests || []).forEach(r => {
          notifs.push({
            id: `join-${r._id}`,
            type: "join_request",
            title: "Join Request",
            message: `${r.username} wants to join ${p.name}`,
            projectId: p._id,
            projectName: p.name,
            from: r.user,
            time: r.requestedAt,
            read: false
          });
        });
      });
      
      // Project invitations
      (invitesRes.data || []).forEach(inv => {
        notifs.push({
          id: `invite-${inv._id}`,
          type: "project_invite",
          title: "Project Invitation",
          message: `You are invited to join ${inv.projectName}`,
          projectId: inv.projectId,
          projectName: inv.projectName,
          time: inv.invitedAt,
          read: false
        });
      });
      
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
    setLoading(false);
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (!notifications.find(n => n.id === id)?.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  // Initial fetch and socket listeners
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;
    
    socket.on("friend_request", () => fetchNotifications());
    socket.on("friend_accepted", () => fetchNotifications());
    socket.on("new_invitation", () => fetchNotifications());
    socket.on("incoming_call", (data) => {
      setNotifications(prev => [{
        id: `call-${Date.now()}`,
        type: "incoming_call",
        title: "Incoming Call",
        message: `${data.from?.username || 'Someone'} is calling you`,
        projectId: data.projectId,
        from: data.from,
        time: new Date(),
        read: false
      }, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    socket.on("join_request", () => fetchNotifications());
    
    return () => {
      socket.off("friend_request");
      socket.off("friend_accepted");
      socket.off("new_invitation");
      socket.off("incoming_call");
      socket.off("join_request");
    };
  }, [socket, user]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      removeNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);