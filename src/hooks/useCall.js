import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export function useCall(roomId) {
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const remoteVideosRef = useRef({});

  const [remotePeerIds, setRemotePeerIds] = useState([]);
  const [peerUsers, setPeerUsers] = useState({});
  const [inCall, setInCall] = useState(false);

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  /* ---------------- SOCKET SETUP ---------------- */
  useEffect(() => {
  const token = localStorage.getItem("collab_auth_token");
  if (!token) return;

  const socket = io(import.meta.env.VITE_RTC_URL, {
    auth: { token },
    transports: ["websocket"], // 🔑 IMPORTANT
    withCredentials: true,
  });

  socketRef.current = socket;

  socket.on("call-peers", async (peers) => {
    for (const peerId of peers) {
      const pc = createPeerConnection(peerId);
      peersRef.current[peerId] = pc;

      setRemotePeerIds((prev) =>
        prev.includes(peerId) ? prev : [...prev, peerId]
      );

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("offer", { to: peerId, sdp: offer });
    }
  });

  socket.on("offer", async ({ from, sdp, user }) => {
    if (user) {
      setPeerUsers((prev) => ({ ...prev, [from]: user }));
    }

    const pc = createPeerConnection(from);
    peersRef.current[from] = pc;

    setRemotePeerIds((prev) =>
      prev.includes(from) ? prev : [...prev, from]
    );

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", { to: from, sdp: answer });
  });

  socket.on("answer", async ({ from, sdp }) => {
    await peersRef.current[from]?.setRemoteDescription(
      new RTCSessionDescription(sdp)
    );
  });

  socket.on("ice-candidate", ({ from, candidate }) => {
    peersRef.current[from]?.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  });

  socket.on("user-left-call", (socketId) => {
    peersRef.current[socketId]?.close();
    delete peersRef.current[socketId];
    delete remoteVideosRef.current[socketId];

    setRemotePeerIds((prev) =>
      prev.filter((id) => id !== socketId)
    );
  });

  return () => {
    socket.disconnect();
  };
}, [roomId]);


  /* ---------------- PEER CONNECTION ---------------- */
  function createPeerConnection(remoteSocketId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    localStreamRef.current?.getTracks().forEach((track) =>
      pc.addTrack(track, localStreamRef.current)
    );

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (remoteVideosRef.current[remoteSocketId]) {
        remoteVideosRef.current[remoteSocketId].srcObject = stream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    return pc;
  }

  /* ---------------- CALL CONTROLS ---------------- */
  async function joinCall() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    setInCall(true);

    socketRef.current.emit("join-call", { roomId });
  }

  function leaveCall() {
    socketRef.current.emit("leave-call", { roomId });

    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    setRemotePeerIds([]);

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setInCall(false);
  }

  function toggleMic() {
    localStreamRef.current?.getAudioTracks().forEach(
      (t) => (t.enabled = !micEnabled)
    );
    setMicEnabled((m) => !m);
  }

  function toggleCamera() {
    localStreamRef.current?.getVideoTracks().forEach(
      (t) => (t.enabled = !cameraEnabled)
    );
    setCameraEnabled((c) => !c);
  }

  return {
    joinCall,
    leaveCall,
    inCall,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
    localStreamRef,
    remoteVideosRef,
    remotePeerIds,
    peerUsers,
  };
}
