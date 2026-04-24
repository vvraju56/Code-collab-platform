require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const setupWSConnection = require('y-websocket/bin/utils').setupWSConnection;
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 1234;
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Yjs WebSocket Server is running');
});

const wss = new WebSocket.Server({ 
  noServer: true 
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');
  const projectId = url.pathname.substring(url.pathname.lastIndexOf('/') + 1) || 'default';

  if (!token) {
    socket.destroy();
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
    
    // In a real app, you would check MongoDB here to verify if user has access to projectId
    // For this demo, we'll allow if token is valid
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    socket.destroy();
  }
});

wss.on('connection', (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1) || 'default';
  
  setupWSConnection(conn, req, {
    docName: roomName,
    gc: true
  });
  
  console.log(`User ${req.user?.userId} connected to room: ${roomName}`);
});

server.listen(port, () => {
  console.log(`Yjs server listening on port ${port}`);
});
