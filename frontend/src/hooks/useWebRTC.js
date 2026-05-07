import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useWebRTC(projectId) {
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [inCall, setInCall] = useState(false);
  const peerConnections = useRef({});
  const remoteUsername = useRef({});

  const createPeerConnection = useCallback((remoteSocketId, createForReceiveOnly = false) => {
    if (peerConnections.current[remoteSocketId]) {
      return peerConnections.current[remoteSocketId];
    }

    console.log('[WebRTC] Creating peer connection to:', remoteSocketId, 'receiveOnly:', createForReceiveOnly);
    
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnections.current[remoteSocketId] = pc;

    // If we have a local stream, add tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_ice", {
          to: remoteSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received track from:', remoteSocketId);
      if (event.streams && event.streams[0]) {
        // Add username to stream
        event.streams[0].username = remoteUsername.current[remoteSocketId] || 'Remote';
        setRemoteStreams(prev => ({
          ...prev,
          [remoteSocketId]: event.streams[0]
        }));
      }
    };

    return pc;
  }, [socket, localStream]);

  const startCall = useCallback(async (username = null) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      setInCall(true);
      console.log('[WebRTC] Emitting call_started for project:', projectId);
      socket.emit("call_started", { projectId, username });
      return stream;
    } catch (err) {
      console.error("Error starting call:", err);
      return null;
    }
  }, [socket, projectId]);

  const joinCall = useCallback(async (stream = null, username = null) => {
    // If no stream provided, join in view-only mode
    if (!stream) {
      setInCall(true);
      // Still emit call_joined so the initiator knows we joined
      socket.emit("call_joined", { projectId, username });
      return null;
    }
    
    setLocalStream(stream);
    setInCall(true);
    socket.emit("call_joined", { projectId, username });
    return stream;
  }, [socket, projectId]);

  const stopCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    setLocalStream(null);
    setInCall(false);
    // Close peer connections but don't fully cleanup - others might still be connected
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    // Don't clear remote streams - let them see who left
    // setRemoteStreams({}); // Removed this line
    socket.emit("call_left", { projectId });
  }, [localStream, socket, projectId]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setLocalStream(stream);
      
      // Update all peer connections with new video track
      const videoTrack = stream.getVideoTracks()[0];
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      // Handle when screen share stops
      videoTrack.onended = () => {
        // Switch back to camera
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(camStream => {
          setLocalStream(camStream);
          const camVideoTrack = camStream.getVideoTracks()[0];
          Object.values(peerConnections.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === "video");
            if (sender) {
              sender.replaceTrack(camVideoTrack);
            }
          });
        });
      };
      
      return stream;
    } catch (err) {
      console.error("Screen share error:", err);
      return null;
    }
  }, []);

  // Socket handlers
  useEffect(() => {
    if (!socket) return;

    // When we receive an offer, create answer
    socket.on("webrtc_offer", async ({ from, offer }) => {
      console.log('[WebRTC] Received offer from:', from, 'current inCall:', inCall);
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc_answer", { to: from, answer });
      console.log('[WebRTC] Sent answer to:', from);
    });

    // When we receive an answer, set remote description
    socket.on("webrtc_answer", async ({ from, answer }) => {
      console.log('[WebRTC] Received answer from:', from);
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // When we receive ICE candidate, add it
    socket.on("webrtc_ice", async ({ from, candidate }) => {
      console.log('[WebRTC] Received ICE from:', from);
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // When someone joins our call, send them an offer
    socket.on("call_joined", async ({ from, username }) => {
      console.log('[WebRTC] Someone joined our call:', from, username);
      if (username) {
        remoteUsername.current[from] = username;
      }
      // Always send offer to new joiner (even if they have no media, they can still see ours)
      if (inCall) {
        setTimeout(async () => {
          console.log('[WebRTC] Sending offer to:', from);
          const pc = createPeerConnection(from);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc_offer", { to: from, offer });
        }, 500);
      }
    });

    // When call ends (everyone left)
    socket.on("call_ended", () => {
      console.log('[WebRTC] Call ended (everyone left)');
      stopCall();
      setRemoteStreams({});
    });

    // When someone leaves the call (others stay)
    socket.on("call_left", ({ from }) => {
      console.log('[WebRTC] Someone left:', from);
      // Remove their stream
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[from];
        return newStreams;
      });
      // Close their peer connection
      if (peerConnections.current[from]) {
        peerConnections.current[from].close();
        delete peerConnections.current[from];
      }
    });

    return () => {
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("webrtc_ice");
      socket.off("call_joined");
      socket.off("call_ended");
      socket.off("call_left");
    };
  }, [socket, createPeerConnection, stopCall, inCall, localStream]);

  // When local stream changes, add to peer connections (only if not already added)
  useEffect(() => {
    if (localStream) {
      Object.values(peerConnections.current).forEach(pc => {
        localStream.getTracks().forEach(track => {
          // Check if sender already exists for this track kind
          const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind);
          if (!existingSender) {
            pc.addTrack(track, localStream);
          }
        });
      });
    }
  }, [localStream]);

  // Send offer when someone joins
  const sendOfferTo = useCallback(async (socketId) => {
    const pc = createPeerConnection(socketId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc_offer", { to: socketId, offer });
  }, [socket, createPeerConnection]);

  return {
    localStream,
    remoteStreams,
    inCall,
    startCall,
    joinCall,
    startScreenShare,
    stopCall,
    sendOfferTo
  };
}