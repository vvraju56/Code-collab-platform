import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC(projectId) {
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> stream
  const peerConnections = useRef({}); // socketId -> RTCPeerConnection

  const createPeerConnection = useCallback((remoteSocketId, isOffer) => {
    if (peerConnections.current[remoteSocketId]) return peerConnections.current[remoteSocketId];

    const pc = new RTCPeerConnection(configuration);
    peerConnections.current[remoteSocketId] = pc;

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_signal", {
          to: remoteSocketId,
          signal: event.candidate,
          type: "candidate",
          projectId
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [remoteSocketId]: event.streams[0]
      }));
    };

    return pc;
  }, [socket, localStream, projectId]);

  const startCall = useCallback(async (isVideo = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo,
        audio: true
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Error accessing media devices:", err);
      return null;
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setLocalStream(prev => {
        if (prev) prev.getTracks().forEach(t => t.stop());
        return stream;
      });

      // Update tracks for all peer connections
      Object.values(peerConnections.current).forEach(pc => {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track.kind === "video");
        if (sender) sender.replaceTrack(videoTrack);
      });

      return stream;
    } catch (err) {
      console.error("Error starting screen share:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleSignal = async ({ from, signal, type }) => {
      let pc = peerConnections.current[from];

      if (type === "offer") {
        pc = createPeerConnection(from, false);
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc_signal", { to: from, signal: answer, type: "answer", projectId });
      } else if (type === "answer") {
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (type === "candidate") {
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    };

    socket.on("webrtc_signal", handleSignal);
    
    // When a new user joins, we send them an offer if we have a local stream
    socket.on("user_joined_project", async ({ socketId }) => {
      if (localStream) {
        const pc = createPeerConnection(socketId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc_signal", { to: socketId, signal: offer, type: "offer", projectId });
      }
    });

    return () => {
      socket.off("webrtc_signal", handleSignal);
      socket.off("user_joined_project");
      Object.values(peerConnections.current).forEach(pc => pc.close());
      if (localStream) localStream.getTracks().forEach(t => t.stop());
    };
  }, [socket, localStream, createPeerConnection, projectId]);

  return {
    localStream,
    remoteStreams,
    startCall,
    startScreenShare,
    stopCall: () => {
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      setRemoteStreams({});
    }
  };
}
