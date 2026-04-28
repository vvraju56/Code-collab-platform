import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const YJS_URL = import.meta.env.VITE_WS_SERVER_URL || "ws://localhost:1234";

export function useYjsFile({ fileId, token, enabled }) {
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

    const room = `file:${fileId}?token=${token}`;
    const provider = new WebsocketProvider(
      YJS_URL,
      room,
      newYdoc
    );
    providerRef.current = provider;
    setAwareness(provider.awareness);

    const onStatus = (e) => setStatus(e.status);
    provider.on("status", onStatus);

    return () => {
      provider.off("status", onStatus);
      provider.destroy();
      newYdoc.destroy();
      providerRef.current = null;
      setYdoc(null);
      setAwareness(null);
    };
  }, [enabled, fileId, token]);

  return {
    ydoc,
    provider: providerRef.current,
    awareness,
    ytext,
    status,
  };
}

