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

// Map to store sessions: projectId -> { pty, clients: Set<WebSocket> }
const sessions = new Map();

wss.on('connection', (ws, req) => {
  let projectId;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    projectId = url.searchParams.get('projectId') || 'default';
  } catch (e) {
    console.error('Failed to parse connection URL:', e);
    ws.close();
    return;
  }
  
  console.log(`Client connecting to terminal: ${projectId}`);

  let session = sessions.get(projectId);
  
  if (!session) {
    console.log(`Creating new PTY session for project: ${projectId}`);
    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.USERPROFILE || process.env.HOME || process.cwd(),
        env: process.env
      });

      session = {
        pty: ptyProcess,
        clients: new Set()
      };

      sessions.set(projectId, session);

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`PTY process exited for project ${projectId} with code ${exitCode}`);
        const currentSession = sessions.get(projectId);
        if (currentSession) {
          currentSession.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'output', data: '\r\nProcess exited\r\n' }));
            }
          });
          sessions.delete(projectId);
        }
      });
    } catch (err) {
      console.error('Failed to spawn PTY:', err);
      ws.close();
      return;
    }
  }

  session.clients.add(ws);

  // Send initial message
  ws.send(JSON.stringify({ type: 'output', data: '\r\n--- Connected to Shared Terminal ---\r\n' }));

  const dataListener = session.pty.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.type === 'input') {
        session.pty.write(payload.data);
      } else if (payload.type === 'resize') {
        session.pty.resize(payload.cols, payload.rows);
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected from project: ${projectId}`);
    dataListener.dispose();
    
    const currentSession = sessions.get(projectId);
    if (currentSession) {
      currentSession.clients.delete(ws);
      
      // If no clients left, clean up after a small delay to allow for page refreshes
      if (currentSession.clients.size === 0) {
        setTimeout(() => {
          const latestSession = sessions.get(projectId);
          if (latestSession && latestSession.clients.size === 0) {
            console.log(`Cleaning up idle PTY session for project: ${projectId}`);
            latestSession.pty.kill();
            sessions.delete(projectId);
          }
        }, 30000); // 30 seconds grace period
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for project ${projectId}:`, err);
  });
});

const PORT = process.env.TERMINAL_PORT || process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Terminal service listening on port ${PORT}`);
});
