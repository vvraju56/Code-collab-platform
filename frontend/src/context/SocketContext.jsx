import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [globalCount, setGlobalCount] = useState(0);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    const s = socketRef.current;

    s.on("connect", () => {
      setConnected(true);
      console.log("✅ Socket connected:", s.id);
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    s.on("global_user_count", (count) => setGlobalCount(count));

    return () => {
      s.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, globalCount }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
