import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const WS_SERVER_URL = import.meta.env.VITE_WS_SERVER_URL || import.meta.env.VITE_API_URL?.replace("/api", "").replace("http", "ws") || "ws://localhost:5000";

export function useYjsFile({ fileId, token, enabled, user }) {
  const [status, setStatus] = useState("disconnected");
  const [ydoc, setYdoc] = useState(null);
  const providerRef = useRef(null);
  const [awareness, setAwareness] = useState(null);

  const ytext = useMemo(() => {
    if (!ydoc) return null;
    return ydoc.getText("monaco");
  }, [ydoc]);

  useEffect(() => {
    if (!enabled || !fileId || !token) {
      setYdoc(null);
      return;
    }

    const newYdoc = new Y.Doc();
    setYdoc(newYdoc);

    const roomName = `file:${fileId}`;
    console.log(`[YJS] Connecting to room: ${roomName} at ${WS_SERVER_URL}`);
    
    const provider = new WebsocketProvider(
      WS_SERVER_URL,
      roomName,
      newYdoc,
      { params: { token } }
    );
    providerRef.current = provider;
    
    const awarenessInstance = provider.awareness;
    setAwareness(awarenessInstance);

    if (user) {
      awarenessInstance.setLocalStateField("user", {
        name: user.username || user.name || "Anonymous",
        color: user.cursorColor || "#3b82f6"
      });
    }

    const onStatus = (e) => {
      console.log(`[YJS] Status changed: ${e.status}`);
      setStatus(e.status);
    };
    provider.on("status", onStatus);

    provider.on('connection', (conn) => {
      console.log('[YJS] WebSocket connected');
    });

    provider.on('connection-close', (conn) => {
      console.log('[YJS] WebSocket disconnected');
    });

    // Log sync events
    provider.on('sync', (isSynced) => {
      console.log('[YJS] Sync status:', isSynced);
    });

    return () => {
      provider.off("status", onStatus);
      provider.destroy();
      newYdoc.destroy();
      providerRef.current = null;
      setYdoc(null);
      setAwareness(null);
    };
  }, [enabled, fileId, token]);

  useEffect(() => {
    if (awareness && user) {
      awareness.setLocalStateField("user", {
        name: user.username || user.name || "Anonymous",
        color: user.cursorColor || "#3b82f6"
      });
    }
  }, [awareness, user]);

  return {
    ydoc,
    provider: providerRef.current,
    awareness,
    ytext,
    status,
  };
}

