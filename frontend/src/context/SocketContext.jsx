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

    const socketInstance = io(SOCKET_URL, {
      auth: { token },
      // Removed restricted transports to allow polling fallback
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      timeout: 10000
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      setConnected(true);
      console.log("✅ Socket connected:", socketInstance.id);
    });

    socketInstance.on("disconnect", (reason) => {
      setConnected(false);
      if (reason === "io client disconnect") {
        // intentionally disconnected
      }
    });

    socketInstance.on("global_user_count", (count) => setGlobalCount(count));

    return () => {
      if (socketInstance) {
        socketInstance.removeAllListeners();
        socketInstance.disconnect();
      }
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
