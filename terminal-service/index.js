require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// Map to store terminals by project/room
const terminals = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const projectId = url.searchParams.get('projectId') || 'default';
  
  console.log(`Client connected to terminal for project: ${projectId}`);

  let ptyProcess;
  
  if (terminals.has(projectId)) {
    ptyProcess = terminals.get(projectId);
  } else {
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: process.env
    });
    terminals.set(projectId, ptyProcess);
  }

  // Send initial data
  // Note: For a real production app, we would need to buffer and send the last N lines
  
  ptyProcess.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  ws.on('message', (message) => {
    const payload = JSON.parse(message);
    if (payload.type === 'input') {
      ptyProcess.write(payload.data);
    } else if (payload.type === 'resize') {
      ptyProcess.resize(payload.cols, payload.rows);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected from terminal: ${projectId}`);
    // Optional: Clean up terminal if no clients are connected
  });
});

const PORT = process.env.TERMINAL_PORT || process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Terminal service listening on port ${PORT}`);
});
