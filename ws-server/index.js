require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const setupWSConnection = require('y-websocket/bin/utils').setupWSConnection;
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const port = process.env.WS_PORT || process.env.PORT || 1234;
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/collabDB';

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB (ws-server)'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Simple File schema for persistence
const fileSchema = new mongoose.Schema({
  content: String,
  lastEditedAt: Date,
  size: Number
}, { strict: false });
const File = mongoose.model('File', fileSchema);

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Yjs WebSocket Server is running');
});

const wss = new WebSocket.Server({ 
  noServer: true 
});

process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
});

server.on('upgrade', (request, socket, head) => {
  console.log(`[UPGRADE] Request URL: ${request.url}`);
  const url = new URL(request.url, `http://${request.headers.host}`);
  let token = url.searchParams.get('token');
  
  // Robust fallback for token extraction
  if (!token) {
    const decodedUrl = decodeURIComponent(request.url);
    if (decodedUrl.includes('token=')) {
      const parts = decodedUrl.split('token=');
      // Fix: better extraction if token is at the end
      token = parts[1].split('&')[0].split('?')[0].split('#')[0];
    }
  }

  if (!token) {
    console.log(`[AUTH] Rejecting connection: No token found in ${request.url}`);
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
    console.log(`[AUTH] Rejecting connection: Invalid token. Error: ${err.message}`);
    socket.destroy();
  }
});

wss.on('connection', (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const decodedPathname = decodeURIComponent(url.pathname);
  let roomName = decodedPathname.substring(decodedPathname.lastIndexOf('/') + 1) || 'default';
  
  // Better room name cleanup
  if (roomName.includes('?')) {
    roomName = roomName.split('?')[0];
  }
  if (roomName.includes('token=')) {
    roomName = roomName.split('token=')[0].replace(/[&?]$/, '');
  }
  
  console.log(`[YJS] Connection established. User: ${req.user?.userId}, Room: ${roomName}`);
  
  // We need to get the doc that setupWSConnection creates
  // but it doesn't return it directly. We can use getYDoc from utils.
  const { getYDoc } = require('y-websocket/bin/utils');
  
  setupWSConnection(conn, req, {
    docName: roomName,
    gc: true
  });

  // Persistence: Load from DB if room looks like a file ID
  const fileIdMatch = roomName.match(/^file:([a-f\d]{24})$/);
  if (fileIdMatch) {
    const fileId = fileIdMatch[1];
    const doc = getYDoc(roomName);
    const ytext = doc.getText('monaco');
    let loaded = false;
    
    // Only load if the doc is empty (newly created in memory)
    if (ytext.length === 0) {
      File.findById(fileId).then(file => {
        // Check if already loaded to prevent duplicates
        if (file && file.content && ytext.length === 0 && !loaded) {
          loaded = true;
          console.log(`[PERSIST] Loading content for ${fileId} from DB (${file.content.length} chars)`);
          ytext.insert(0, file.content);
        }
      }).catch(err => console.error(`[PERSIST] Error loading ${fileId}:`, err));
    }

    // Save to DB on changes
    let saveTimeout;
    doc.on('update', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          const content = ytext.toString();
          await File.findByIdAndUpdate(fileId, { 
            content,
            lastEditedAt: new Date(),
            size: Buffer.byteLength(content, 'utf8')
          });
          console.log(`[PERSIST] Saved ${fileId} to DB`);
        } catch (err) {
          console.error(`[PERSIST] Error saving ${fileId}:`, err);
        }
      }, 3000);
    });
  }
});

server.listen(port, () => {
  console.log(`Yjs server listening on port ${port}`);
});
