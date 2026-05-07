import { useState, useEffect, useRef } from "react";
import { useWebRTC } from "../../hooks/useWebRTC";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-hot-toast";

export default function ConferencePanel({ projectId }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { localStream, remoteStreams, inCall, startCall, joinCall, startScreenShare, stopCall, sendOfferTo } = useWebRTC(projectId);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [callInitiator, setCallInitiator] = useState(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Check for active call on mount
  useEffect(() => {
    // Only check localStorage on mount once
    const hasExistingCall = localStorage.getItem(`call_${projectId}`);
    if (hasExistingCall && !inCall) {
      // Only set as reconnect if there's actually a call happening (we'll detect this from socket)
      // For now, just remove the stale storage
      localStorage.removeItem(`call_${projectId}`);
    }
  }, []);

  // Listen for call notifications
  useEffect(() => {
    if (!socket) {
      console.log('[ConferencePanel] No socket');
      return;
    }

    console.log('[ConferencePanel] Setting up socket listeners');
    
    socket.on("call_started", ({ from, username }) => {
      console.log('[ConferencePanel] call_started received from:', from, 'my id:', socket.id, 'username:', username);
      if (from !== socket.id) {
        setCallInitiator(from);
        // Also set a timeout to auto-show join button
        setTimeout(() => {
          setCallInitiator(from);
        }, 1000);
      }
    });

    socket.on("call_joined", ({ from, username }) => {
      console.log('[ConferencePanel] call_joined received from:', from);
      if (inCall && from !== socket.id) {
        setTimeout(() => sendOfferTo(from), 1000);
      }
    });

    socket.on("call_ended", () => {
      console.log('[ConferencePanel] call_ended received');
      setCallInitiator(null);
      localStorage.removeItem(`call_${projectId}`);
      if (inCall) {
        stopCall();
      }
    });

    socket.on("call_left", ({ from, username }) => {
      console.log('[ConferencePanel] call_left from:', username || from);
      // Just show a notification, don't stop our call
    });

    return () => {
      socket.off("call_started");
      socket.off("call_joined");
      socket.off("call_ended");
    };
  }, [socket, inCall, sendOfferTo, stopCall]);

  const handleStartCall = async () => {
    const stream = await startCall(user?.username);
    if (stream) {
      localStorage.setItem(`call_${projectId}`, Date.now().toString());
    }
  };

  const handleJoinCall = async () => {
    setShowJoinModal(true);
  };

  const handleJoinConfirm = async (withVideo, withAudio) => {
    setShowJoinModal(false);
    try {
      let stream = null;
      
      // Only request media if they want video or audio
      if (withVideo || withAudio) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: withVideo,
          audio: withAudio
        });
      }
      
      // Use joinCall from useWebRTC to properly set up the stream
      await joinCall(stream, user?.username);
      toast.success("Joined the call!");
    } catch (err) {
      console.error("Join call error:", err);
      // If they chose no video/audio, don't show error
      toast.success("Joined the call (view only)!");
    }
  };

  const handleToggleCall = () => {
    if (inCall) {
      stopCall();
      localStorage.removeItem(`call_${projectId}`);
    } else {
      handleStartCall();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-64 shrink-0">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Conference</h3>
        <button
          onClick={handleToggleCall}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            inCall ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {inCall ? "📞" : "🎥"}
        </button>
      </div>

      {/* Join button when someone else is in call */}
      {(callInitiator && !inCall) && (
        <div className="p-3 border-b border-slate-800">
          <button
            onClick={handleJoinCall}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition"
          >
            {callInitiator === 'reconnect' ? '🔄 Reconnect to Call' : '📞 Join Call'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {inCall && localStream && (
          <>
            <div className="relative group">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video bg-black rounded-xl object-cover border-2 border-blue-500/50"
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[9px] text-white font-bold">
                You
              </div>
              {startScreenShare && (
                <button 
                  onClick={startScreenShare}
                  className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-blue-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Share Screen"
                >
                  🖥️
                </button>
              )}
            </div>

            {Object.keys(remoteStreams).map(socketId => (
              <RemoteVideo key={socketId} stream={remoteStreams[socketId]} socketId={socketId} />
            ))}
          </>
        )}

        {!inCall && !callInitiator && (
          <div className="flex flex-col items-center justify-center h-40 text-center opacity-30">
            <span className="text-4xl mb-2">📹</span>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Camera Off</p>
            <p className="text-[9px] text-slate-500 mt-2">Start a call or join when someone calls</p>
          </div>
        )}
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-72">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Join Call</h3>
            <p className="text-xs text-slate-400 mb-4">Choose how to join:</p>
            <div className="space-y-2">
              <button
                onClick={() => handleJoinConfirm(true, true)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl"
              >
                🎥 Join with Video & Audio
              </button>
              <button
                onClick={() => handleJoinConfirm(false, true)}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl"
              >
                🎤 Join with Audio Only
              </button>
              <button
                onClick={() => handleJoinConfirm(false, false)}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl"
              >
                👁️ Join without Video/Audio
              </button>
            </div>
            <button
              onClick={() => setShowJoinModal(false)}
              className="w-full mt-3 py-2 text-slate-400 text-xs font-bold uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RemoteVideo({ stream, socketId }) {
  const videoRef = useRef(null);
  const username = stream?.username || socketId?.slice(0, 8) || 'Remote';

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full aspect-video bg-black rounded-xl object-cover border border-slate-800"
      />
      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[9px] text-white font-bold">
        {username}
      </div>
    </div>
  );
}