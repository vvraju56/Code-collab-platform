import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL || "ws://localhost:4000";

export default function TerminalPanel({ projectId }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const socketRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0f172a',
        foreground: '#f8fafc',
        cursor: '#3b82f6',
        selectionBackground: '#334155',
      },
      fontSize: 12,
      fontFamily: '"JetBrains Mono", monospace',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Small delay to ensure DOM is rendered before fitting
    setTimeout(() => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.warn("Terminal fit failed:", e);
        }
      }
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to terminal websocket
    const socket = new WebSocket(`${TERMINAL_WS_URL}?projectId=${projectId}`);
    socketRef.current = socket;

    socket.onopen = () => {
      term.writeln('Connected to shared terminal session...');
      // Fit again after connection
      setTimeout(() => fitAddon.fit(), 200);
    };

    socket.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'output') {
          term.write(data);
        }
      } catch (e) {
        // Fallback for non-JSON messages if any
        term.write(event.data);
      }
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ 
              type: 'resize', 
              cols: term.cols, 
              rows: term.rows 
            }));
          }
        } catch (e) {
          console.warn("Resize fit failed:", e);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      socket.close();
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [projectId]);

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <div className="p-2 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shared Terminal</span>
      </div>
      <div ref={terminalRef} className="flex-1 overflow-hidden p-2" />
    </div>
  );
}
