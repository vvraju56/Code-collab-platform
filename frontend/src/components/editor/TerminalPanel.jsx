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
  const reconnectTimeoutRef = useRef(null);

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
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    function connect() {
      if (socketRef.current) {
        socketRef.current.close();
      }

      const socket = new WebSocket(`${TERMINAL_WS_URL}?projectId=${projectId}`);
      socketRef.current = socket;

      socket.onopen = () => {
        term.writeln('Connected to shared terminal session...');
        // Fit after connection
        setTimeout(() => {
          if (fitAddonRef.current) fitAddonRef.current.fit();
        }, 100);
      };

      socket.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'output') {
            term.write(data);
          }
        } catch (e) {
          term.write(event.data);
        }
      };

      socket.onclose = () => {
        term.writeln('\r\nConnection closed. Retrying in 5s...');
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      socket.onerror = (err) => {
        console.error('Terminal WebSocket error:', err);
      };
    }

    connect();

    term.onData((data) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ 
              type: 'resize', 
              cols: term.cols, 
              rows: term.rows 
            }));
          }
        } catch (e) {
          // ignore fit errors
        }
      }
    };

    // Window resize event
    window.addEventListener('resize', handleResize);

    // ResizeObserver for layout changes (e.g. sidebars)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent reconnection on cleanup
        socketRef.current.close();
      }
      term.dispose();
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
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
