import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import axios from "axios";
import { toast } from "react-hot-toast";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function SearchFriendsPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchProjects, setSearchProjects] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [activeSection, setActiveSection] = useState("search");

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
    const interval = setInterval(() => { fetchFriendRequests(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("friend_request", () => { fetchFriendRequests(); });
    socket.on("friend_accepted", () => { fetchFriends(); fetchFriendRequests(); });
    return () => { socket.off("friend_request"); socket.off("friend_accepted"); };
  }, [socket]);

  const fetchFriends = async () => {
    try {
      const res = await axios.get(`${API}/users/friends`);
      setFriends(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchFriendRequests = async () => {
    try {
      const res = await axios.get(`${API}/users/requests`);
      setFriendRequests(res.data || []);
    } catch (err) { console.error(err); }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 1) {
      setSearchUsers([]);
      setSearchProjects([]);
      return;
    }
    setSearching(true);
    try {
      const res = await axios.get(`${API}/users/search?q=${encodeURIComponent(query)}`);
      setSearchUsers(res.data.users || []);
      setSearchProjects(res.data.projects || []);
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  const handleSendFriendRequest = async (userId) => {
    try {
      await axios.post(`${API}/users/friends/${userId}`);
      toast.success("Friend request sent!");
      setSearchUsers(prev => prev.filter(u => u._id !== userId));
    } catch (err) { toast.error(err.response?.data?.error || "Failed to send request"); }
  };

  const handleAcceptFriendRequest = async (requestId) => {
    try {
      await axios.post(`${API}/users/friends/${requestId}/accept`);
      toast.success("Friend added!");
      setFriendRequests(prev => prev.filter(r => r._id !== requestId));
      fetchFriends();
    } catch (err) { toast.error("Failed to accept"); }
  };

  const handleRejectFriendRequest = async (requestId) => {
    try {
      await axios.post(`${API}/users/friends/${requestId}/reject`);
      toast.success("Request rejected");
      setFriendRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (err) { toast.error("Failed to reject"); }
  };

  const handleJoinProject = async (projectId) => {
    try {
      await axios.post(`${API}/projects/${projectId}/join`);
      toast.success("Join request sent!");
      setSearchProjects(prev => prev.filter(p => p._id !== projectId));
    } catch (err) { toast.error(err.response?.data?.error || "Failed to send request"); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-3 hover:opacity-80 transition">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xs text-white">CB</div>
              <span className="font-black text-lg hidden sm:block">CodeBloc</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/dashboard")} className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition">← Dashboard</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white">Search & Friends</h1>
          <p className="text-slate-400 text-sm">Find users and public projects</p>
        </motion.div>

        <div className="flex gap-2 mb-6 p-1 bg-slate-900/60 border border-slate-800 rounded-xl w-fit overflow-x-auto">
          <button onClick={() => setActiveSection("search")} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeSection === "search" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>🔍 Search</button>
          <button onClick={() => setActiveSection("friends")} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeSection === "friends" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>🤝 Friends</button>
          <button onClick={() => setActiveSection("requests")} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeSection === "requests" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>📥 Requests {friendRequests.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-[10px]">{friendRequests.length}</span>}</button>
        </div>

        {activeSection === "search" && (
          <div className="space-y-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">🔍</span>
              <input 
                value={searchQuery} 
                onChange={e => handleSearch(e.target.value)} 
                placeholder="Search users or projects..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm focus:border-blue-500 transition" 
              />
            </div>

            {searchQuery.length > 0 && (
              <div className="space-y-4">
                {searchUsers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-3">Users</h3>
                    <div className="space-y-2">
                      {searchUsers.map(u => (
                        <div key={u._id} className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                          <div className="flex items-center gap-3">
                            <img src={`https://ui-avatars.com/api/?name=${u.username}&background=2563eb&color=fff&size=32`} className="w-8 h-8 rounded-lg" alt="" />
                            <span className="font-bold text-white">{u.username}</span>
                          </div>
                          <button onClick={() => handleSendFriendRequest(u._id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition">Add Friend</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchProjects.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-3">Public Projects</h3>
                    <div className="space-y-2">
                      {searchProjects.map(p => (
                        <div key={p._id} className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                          <div>
                            <span className="font-bold text-white">{p.name}</span>
                            <p className="text-xs text-slate-500">{p.description || "No description"}</p>
                          </div>
                          <button onClick={() => handleJoinProject(p._id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition">Join</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!searching && searchUsers.length === 0 && searchProjects.length === 0 && (
                  <div className="text-center py-8 text-slate-500">No results found</div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === "friends" && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider">My Friends ({friends.length})</h3>
            {friends.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No friends yet. Search for users to add!</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {friends.map(f => (
                  <div key={f._id} className="flex items-center gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <img src={`https://ui-avatars.com/api/?name=${f.username}&background=2563eb&color=fff&size=32`} className="w-8 h-8 rounded-lg" alt="" />
                    <span className="font-bold text-white">{f.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === "requests" && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider">Friend Requests ({friendRequests.length})</h3>
            {friendRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No pending requests</div>
            ) : (
              <div className="space-y-2">
                {friendRequests.map(r => (
                  <div key={r._id} className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <img src={`https://ui-avatars.com/api/?name=${r.from?.username || 'U'}&background=2563eb&color=fff&size=32`} className="w-8 h-8 rounded-lg" alt="" />
                      <span className="font-bold text-white">{r.from?.username || r.username}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAcceptFriendRequest(r._id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg">Accept</button>
                      <button onClick={() => handleRejectFriendRequest(r._id)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs font-bold rounded-lg">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}