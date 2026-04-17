# CodeBloc — Real-Time Code Collaboration Platform

> Mini GitHub + VS Code in your browser. Multiple users edit code live with cursor tracking, team chat, version control, and a code execution sandbox.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Monaco Editor, Framer Motion |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB (Mongoose) |
| Cache/PubSub | Redis |
| Realtime | WebSockets (Socket.IO) |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
collab-platform/
├── backend/
│   ├── index.js               # Express + Socket.IO entry
│   ├── models/
│   │   ├── User.js            # User schema
│   │   ├── Project.js         # Project schema
│   │   ├── File.js            # File schema
│   │   ├── Version.js         # Commit/version schema
│   │   └── ChatMessage.js     # Chat schema
│   ├── routes/
│   │   ├── auth.js            # Register, Login, Me
│   │   ├── projects.js        # Project CRUD + collaborators
│   │   ├── files.js           # File CRUD
│   │   ├── versions.js        # Commit, log, revert
│   │   ├── execution.js       # Code sandbox
│   │   └── dashboard.js       # Stats
│   ├── socket/
│   │   └── socketManager.js   # All realtime logic
│   ├── middleware/
│   │   └── auth.js            # JWT auth (HTTP + Socket)
│   ├── .env
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Router
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── context/
│   │   │   ├── AuthContext.jsx    # Global auth state
│   │   │   └── SocketContext.jsx  # Global socket
│   │   ├── hooks/
│   │   │   ├── useProjects.js     # Project CRUD hook
│   │   │   └── useEditor.js       # Editor + collab hook
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx       # Login / Register
│   │   │   ├── DashboardPage.jsx  # Project list + team
│   │   │   └── EditorPage.jsx     # Full IDE layout
│   │   └── components/
│   │       ├── editor/
│   │       │   ├── CollabEditor.jsx   # Monaco + remote cursors
│   │       │   ├── FileTree.jsx       # File explorer
│   │       │   ├── VersionPanel.jsx   # Git-like commits
│   │       │   └── ExecutionPanel.jsx # Run code
│   │       ├── chat/
│   │       │   └── ChatPanel.jsx      # Real-time chat
│   │       └── layout/
│   │           └── LoadingScreen.jsx
│   ├── .env
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
└── docker-compose.yml
```

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas — already configured in .env)
- Redis (optional for local dev)

### 1. Backend

```bash
cd backend
npm install
npm run dev
# Server running on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:5173
```

### 3. Docker (Full Stack)

```bash
# From root directory
docker-compose up --build
# Frontend → http://localhost:5173
# Backend  → http://localhost:5000
```

---

## Features

### Realtime Collaboration
- Multiple users edit the same file simultaneously
- Live cursor tracking with colored labels per user
- Changes broadcast via WebSocket with auto-save to MongoDB every 3 seconds
- See who is online in the editor top bar

### Version Control
- Commit snapshots of any file with a message
- Full commit log with author, timestamp, lines added/removed
- One-click revert to any previous version
- SHA-1 commit hashes (like Git)

### Team Chat
- Per-project chat room via Socket.IO
- Typing indicators
- Message history persisted in MongoDB
- Messages appear instantly for all collaborators

### Code Execution Sandbox
- Run JavaScript, Python, and Bash directly in-browser
- 10-second timeout protection
- stdout + stderr separated
- Execution time shown in ms

### Project Management
- Create projects with name, description, language, public/private
- Invite collaborators by username
- Role system: viewer / editor / admin
- Auto-generated starter files per language

---

## Environment Variables

### Backend `.env`
```
PORT=5000
MONGO_URI=mongodb+srv://...   # Your MongoDB URI
JWT_SECRET=supersecretkey123
REDIS_URL=redis://localhost:6379
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Socket Events Reference

| Event | Direction | Description |
|---|---|---|
| `join_room` | Client → Server | Join global dashboard room |
| `join_project` | Client → Server | Join a project collab room |
| `open_file` | Client → Server | Open a file, get current content |
| `code_change` | Bidirectional | Broadcast code edits |
| `cursor_move` | Client → Server | Broadcast cursor position |
| `cursor_update` | Server → Client | Receive peer cursor |
| `send_message` | Client → Server | Send chat message |
| `new_message` | Server → Client | Receive chat message |
| `user_joined` | Server → Client | Peer connected to room |
| `user_left` | Server → Client | Peer disconnected |
| `room_users` | Server → Client | Full list of room users |
| `project_users` | Server → Client | Users in project room |
| `global_user_count` | Server → Client | Total connected users |

---

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login, get JWT
- `GET /api/auth/me` — Get current user

### Projects
- `GET /api/projects` — List all accessible projects
- `POST /api/projects` — Create project
- `GET /api/projects/:id` — Get project
- `PUT /api/projects/:id` — Update project
- `DELETE /api/projects/:id` — Delete project
- `POST /api/projects/:id/collaborators` — Invite user
- `DELETE /api/projects/:id/collaborators/:userId` — Remove user

### Files
- `GET /api/files/project/:projectId` — List project files
- `GET /api/files/:id` — Get file with content
- `POST /api/files` — Create file
- `PUT /api/files/:id` — Save content
- `DELETE /api/files/:id` — Delete file

### Versions
- `POST /api/versions/commit` — Commit snapshot
- `GET /api/versions/file/:fileId` — File commit log
- `GET /api/versions/project/:projectId` — All project commits
- `POST /api/versions/:id/revert` — Revert to version

### Execution
- `POST /api/execute` — Run code (JS/Python/Bash)

---

Built with ❤️ — CodeBloc Platform
