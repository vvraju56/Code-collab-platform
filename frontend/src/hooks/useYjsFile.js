import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const YJS_URL = import.meta.env.VITE_WS_SERVER_URL || "ws://localhost:1234";

export function useYjsFile({ fileId, token, enabled }) {
  const [status, setStatus] = useState("disconnected");
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const [awareness, setAwareness] = useState(null);

  const ytext = useMemo(() => {
    if (!ydocRef.current) return null;
    return ydocRef.current.getText("monaco");
  }, [fileId]);

  useEffect(() => {
    if (!enabled || !fileId || !token) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const room = `file:${fileId}`;
    const provider = new WebsocketProvider(
      YJS_URL,
      room,
      ydoc,
      { params: { token } },
    );
    providerRef.current = provider;
    setAwareness(provider.awareness);

    const onStatus = (e) => setStatus(e.status);
    provider.on("status", onStatus);

    return () => {
      provider.off("status", onStatus);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      setAwareness(null);
    };
  }, [enabled, fileId, token]);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    awareness,
    ytext,
    status,
  };
}

