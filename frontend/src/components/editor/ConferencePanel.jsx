import { useState, useEffect, useRef } from "react";
import { useWebRTC } from "../../hooks/useWebRTC";

export default function ConferencePanel({ projectId }) {
  const { localStream, remoteStreams, startCall, startScreenShare, stopCall } = useWebRTC(projectId);
  const [active, setActive] = useState(false);
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleToggle = async () => {
    if (active) {
      stopCall();
      setActive(false);
    } else {
      const stream = await startCall();
      if (stream) setActive(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-64 shrink-0">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Conference</h3>
        <button
          onClick={handleToggle}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            active ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {active ? "📞" : "🎥"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {active && (
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
                You (Local)
              </div>
              <button 
                onClick={startScreenShare}
                className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-blue-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Share Screen"
              >
                🖥️
              </button>
            </div>

            {Object.entries(remoteStreams).map(([socketId, stream]) => (
              <RemoteVideo key={socketId} stream={stream} socketId={socketId} />
            ))}
          </>
        )}

        {!active && (
          <div className="flex flex-col items-center justify-center h-40 text-center opacity-30">
            <span className="text-4xl mb-2">📹</span>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Camera Off</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteVideo({ stream, socketId }) {
  const videoRef = useRef(null);

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
        Remote ({socketId.slice(0, 4)})
      </div>
    </div>
  );
}
