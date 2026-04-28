require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const setupWSConnection = require('y-websocket/bin/utils').setupWSConnection;
const jwt = require('jsonwebtoken');

const port = process.env.WS_PORT || process.env.PORT || 1234;
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Yjs WebSocket Server is running');
});

const wss = new WebSocket.Server({ 
  noServer: true 
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let token = url.searchParams.get('token');
  
  // Fallback for cases where '?' might be handled incorrectly by the client library
  if (!token && request.url.includes('token=')) {
    const parts = request.url.split('token=');
    token = parts[1];
  }

  if (!token) {
    console.log(`[AUTH] Rejecting connection to ${request.url}: No token found`);
    socket.destroy();
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
    console.log(`[AUTH] Token verified for user: ${decoded.userId}`);
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    console.log(`[AUTH] Rejecting connection: Invalid token. Error: ${err.message}. Secret used length: ${process.env.JWT_SECRET?.length}`);
    socket.destroy();
  }
});

wss.on('connection', (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let roomName = url.pathname.substring(url.pathname.lastIndexOf('/') + 1) || 'default';
  
  // Clean up room name if token was appended to it
  if (roomName.includes('?')) {
    roomName = roomName.split('?')[0];
  } else if (roomName.includes('token=')) {
    roomName = roomName.split('token=')[0].replace(/[&?]$/, '');
  }
  
  console.log(`[YJS] Connection established. User: ${req.user?.userId}, Room: ${roomName}`);
  
  setupWSConnection(conn, req, {
    docName: roomName,
    gc: true
  });
});

server.listen(port, () => {
  console.log(`Yjs server listening on port ${port}`);
});
