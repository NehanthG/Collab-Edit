import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { getMe } from "./utils/auth.js";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { MonacoBinding } from "y-monaco";
import { io } from "socket.io-client";
import TopBar from "./components/TopBar.jsx";
import VideoPanel from "./components/VideoPanel.jsx";
import EditorPane from "./components/EditorPane.jsx";
import TerminalPane from "./components/TerminalPane.jsx";
/* ------------------ LANGUAGES ------------------ */
const LANGUAGES = [
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
  { label: "C", value: "c" },
  { label: "C++", value: "cpp" },
];

/* ------------------ ERROR STYLE ------------------ */
const errorStyle = document.createElement("style");
errorStyle.innerHTML = `
.monaco-editor .execution-error {
  background-color: rgba(255, 0, 0, 0.18);
}
`;
document.head.appendChild(errorStyle);
const typingStyle = document.createElement("style");
typingStyle.innerHTML = `
@keyframes typingDots {
  0% { content: ""; }
  33% { content: "."; }
  66% { content: ".."; }
  100% { content: "..."; }
}

.typing-dots::after {
  content: "";
  animation: typingDots 1.2s steps(3, end) infinite;
}
`;
document.head.appendChild(typingStyle);

const typingPulseStyle = document.createElement("style");
typingPulseStyle.innerHTML = `
@keyframes typingPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0,0,0,0.0);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 0 4px rgba(255,255,255,0.15);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0,0,0,0.0);
  }
}

.avatar-typing {
  animation: typingPulse 1.2s ease-in-out infinite;
}
`;
document.head.appendChild(typingPulseStyle);


export default function Room() {
  const { id } = useParams();
  const runningRef = useRef(false);
  const stdinRef = useRef(null);
  const runButtonRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const animatedClientsRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);

  /* ------------------ STATE ------------------ */
  const [language, setLanguage] = useState("javascript");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  /* ------------------ REFS ------------------ */
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const providerRef = useRef(null);
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const localClientIdRef = useRef(null);

  const errorDecorationIdsRef = useRef([]);
  const remoteDecorationIdsRef = useRef([]);
  const isDecoratingRef = useRef(false);
  const socketRef = useRef(null);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const remoteVideosRef = useRef({});
  const [remotePeerIds, setRemotePeerIds] = useState([]);
  const inCallRef = useRef(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [peerUsers, setPeerUsers] = useState({});
  const [videoOpen, setVideoOpen] = useState(true);



  function resetCallState() {
    // Close peer connections
    Object.values(peersRef.current).forEach(pc => {
      try {
        pc.close();
      } catch { }
    });

    peersRef.current = {};
    remoteVideosRef.current = {};
    setRemotePeerIds([]);

    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setInCall(false);
  }


  function leaveCall() {
    socketRef.current?.emit("leave-call", { roomId: id });
    resetCallState();
  }



  async function joinCall() {
    if (inCall) return;

    // 🔥 IMPORTANT: ensure clean slate
    resetCallState();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;

    setMicEnabled(true);
    setCameraEnabled(true);
    setInCall(true);

    const me = await getMe();

    socketRef.current.emit("join-call", {
      roomId: id,
      user: {
        name: me?.name || "Guest",
        avatar: me?.avatar || null,
      },
    });

  }


  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setCameraEnabled(videoTrack.enabled);
  }


  async function startMedia() {
    // If stream already exists (edge case), stop it first
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;

    // Reset states
    setMicEnabled(true);
    setCameraEnabled(true);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);
  }

  function createPeerConnection(remoteSocketId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Send local tracks (guarded)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track =>
        pc.addTrack(track, localStreamRef.current)
      );
    }

    // Receive remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (remoteVideosRef.current[remoteSocketId]) {
        remoteVideosRef.current[remoteSocketId].srcObject = stream;
      }
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Cleanup on disconnect
    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        pc.close();
      }
    };

    return pc;
  }


  useEffect(() => {
    const socket = io("http://localhost:5002", {
      auth: {
        token: localStorage.getItem("collab_auth_token"),
      },
    });

    socketRef.current = socket;

    socket.on("call-peers", async (peers) => {
      console.log("👥 call-peers", peers);
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
      console.log("📨 offer from", from);
      if (user) {
        setPeerUsers((prev) => ({
          ...prev,
          [from]: user,
        }));
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

    socket.on("answer", async ({ from, sdp, user }) => {
      console.log("📩 answer from", from);

      if (user) {
        setPeerUsers((prev) => ({
          ...prev,
          [from]: user,
        }));
      }

      await peersRef.current[from]
        ?.setRemoteDescription(new RTCSessionDescription(sdp));
    });
    socket.on("user-joined-call", ({ socketId, user }) => {
      console.log("👤 user joined", socketId, user);

      setPeerUsers((prev) => ({
        ...prev,
        [socketId]: user,
      }));
    });



    socket.on("ice-candidate", ({ from, candidate }) => {
      console.log("🧊 ice from", from);
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

      setPeerUsers((prev) => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });
    });



    return () => {
      socket.disconnect();
    };
  }, []);


  useEffect(() => {
    runningRef.current = running;
  }, [running]);



  function formatTerminalOutput(stdin, stdout, stderr) {
    let result = "";

    if (stdin && stdin.trim() !== "") {
      result += "▶ stdin\n";
      result += stdin.trimEnd() + "\n\n";
    }

    if (stdout && stdout.trim() !== "") {
      result += "▶ output\n";
      result += stdout.trimEnd() + "\n";
    }

    if (stderr && stderr.trim() !== "") {
      result += "\n▶ error\n";
      result += stderr.trimEnd();
    }

    return result || "▶ Click Run to execute code";
  }


  /* ------------------ REMOTE CURSORS + SELECTIONS ------------------ */
  function rebuildRemoteDecorations() {
    if (!editorRef.current || !monacoRef.current || !providerRef.current) return;
    if (isDecoratingRef.current) return;

    isDecoratingRef.current = true;

    requestAnimationFrame(() => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const states = providerRef.current.awareness.getStates();
      const localId = providerRef.current.awareness.clientID;

      const decorations = [];

      for (const [clientId, state] of states.entries()) {
        if (clientId === localId) continue;
        if (!state?.selection || !state?.user) continue;

        const { start, end } = state.selection;
        const color = state.user.color;

        if (!start || !end) continue;

        /* selection */
        if (start.line !== end.line || start.column !== end.column) {
          decorations.push({
            range: new monaco.Range(
              start.line,
              start.column,
              end.line,
              end.column
            ),
            options: {
              inlineClassName: `remote-selection-${clientId}`,
            },
          });

          if (!document.getElementById(`remote-selection-style-${clientId}`)) {
            const s = document.createElement("style");
            s.id = `remote-selection-style-${clientId}`;
            s.innerHTML = `
              .remote-selection-${clientId} {
                background: ${color};
                opacity: 0.35;
              }
            `;
            document.head.appendChild(s);
          }
        }

        /* caret */
        decorations.push({
          range: new monaco.Range(
            start.line,
            start.column,
            start.line,
            start.column
          ),
          options: {
            className: `remote-caret-${clientId}`,
          },
        });

        if (!document.getElementById(`remote-caret-style-${clientId}`)) {
          const s = document.createElement("style");
          s.id = `remote-caret-style-${clientId}`;
          s.innerHTML = `
            .remote-caret-${clientId} {
              border-left: 2px solid ${color};
              margin-left: -1px;
            }
          `;
          document.head.appendChild(s);
        }
      }

      remoteDecorationIdsRef.current = editor.deltaDecorations(
        remoteDecorationIdsRef.current,
        decorations
      );

      isDecoratingRef.current = false;
    });
  }

  /* ------------------ EXECUTION ERROR HIGHLIGHT ------------------ */
  function applyErrorsToMonaco(stderr, language) {
    if (!stderr || !editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const decorations = [];

    if (language === "c" || language === "cpp") {
      for (const line of stderr.split("\n")) {
        const m = line.match(/\/app\/main\.(c|cpp):(\d+):\d+:\s*error:\s*(.*)/);
        if (m) {
          decorations.push({
            range: new monaco.Range(Number(m[2]), 1, Number(m[2]), 1),
            options: {
              isWholeLine: true,
              className: "execution-error",
              hoverMessage: [{ value: m[3] }],
            },
          });
          break;
        }
      }
    }

    if (language === "python") {
      const m = stderr.match(/line (\d+)/);
      if (m) {
        decorations.push({
          range: new monaco.Range(Number(m[1]), 1, Number(m[1]), 1),
          options: {
            isWholeLine: true,
            className: "execution-error",
            hoverMessage: [{ value: stderr }],
          },
        });
      }
    }

    if (language === "javascript") {
      decorations.push({
        range: new monaco.Range(1, 1, 1, 1),
        options: {
          isWholeLine: true,
          className: "execution-error",
          hoverMessage: [{ value: stderr }],
        },
      });
    }

    errorDecorationIdsRef.current = editor.deltaDecorations(
      errorDecorationIdsRef.current,
      decorations
    );
  }

  /* ------------------ RUN CODE ------------------ */
  async function runCode() {
    if (!editorRef.current) return;

    setRunning(true);
    setOutput("");

    // clear previous error decorations
    errorDecorationIdsRef.current = editorRef.current.deltaDecorations(
      errorDecorationIdsRef.current,
      []
    );

    const code = editorRef.current.getValue();

    const actualStdin = stdinRef.current?.value || "";

    const needsInput =
      /scanf\s*\(|cin\s*>>|input\s*\(/.test(code);

    if (needsInput && actualStdin.trim() === "") {

      setOutput(
        "⚠️ This program expects input.\n\nPlease provide stdin before running."
      );
      setRunning(false);
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, stdin: actualStdin }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let fullOutput = "";
      let stderrBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullOutput += chunk;
        setOutput(fullOutput);

        // naive stderr detection for error highlighting
        if (chunk.includes("error") || chunk.includes("Traceback")) {
          stderrBuffer += chunk;
        }
      }

      // Apply Monaco error decorations AFTER execution ends
      if (stderrBuffer) {
        applyErrorsToMonaco(stderrBuffer, language);
      }

    } catch (err) {
      setOutput("❌ Failed to execute code");
    } finally {
      setRunning(false);
    }
  }

  const updateParticipants = () => {
    const provider = providerRef.current;
    if (!provider) return;

    const awareness = provider.awareness;
    if (!awareness) return;

    const users = [];
    awareness.getStates().forEach((state, clientId) => {
      if (state?.user) {
        users.push({
          ...state.user,
          clientId,
          typing: state.typing,
        });
      }
    });

    setParticipants(users);
  };



  /* ------------------ PROVIDER ------------------ */
  useEffect(() => {
    let provider;

    async function init() {
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      const token = localStorage.getItem("collab_auth_token");

      provider = new HocuspocusProvider({
        url: "ws://localhost:1234",
        name: id,
        document: ydoc,
        token, // 👈 REQUIRED
      });


      providerRef.current = provider;
      localClientIdRef.current = provider.awareness.clientID;

      const me = await getMe();

      provider.awareness.setLocalStateField("user", {
        id: me?.id || "guest",
        name: me?.name || "Guest",
        avatar: me?.avatar,
        color: me?.color || "#4ade80",
      });


      updateParticipants();
      provider.awareness.on("change", updateParticipants);
      provider.awareness.on("change", rebuildRemoteDecorations);
    }

    init();

    return () => {
      provider?.awareness.off("change", updateParticipants);
      provider?.awareness.off("change", rebuildRemoteDecorations);
      provider?.destroy();
      ydocRef.current?.destroy();
    };
  }, [id]);


  // ✅ PRESENCE LISTENER (correct place)

  /* ------------------ EDITOR MOUNT ------------------ */
  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    const yText = ydocRef.current.getText("monaco");

    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel(),
      new Set([editor]),
      providerRef.current.awareness
    );

    editor.onDidChangeCursorSelection((e) => {
      providerRef.current.awareness.setLocalStateField("selection", {
        start: {
          line: e.selection.startLineNumber,
          column: e.selection.startColumn,
        },
        end: {
          line: e.selection.endLineNumber,
          column: e.selection.endColumn,
        },
      });
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        if (runButtonRef.current && !running) {
          runButtonRef.current.click();
        }
      }
    );

    editor.onDidType(() => {
      const awareness = providerRef.current?.awareness;
      if (!awareness) return;

      awareness.setLocalStateField("typing", true);

      clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        awareness.setLocalStateField("typing", false);
      }, 800);
    });






    rebuildRemoteDecorations();
  }

  /* ------------------ LANGUAGE CHANGE ------------------ */
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    monacoRef.current.editor.setModelLanguage(
      editorRef.current.getModel(),
      language
    );
  }, [language]);


  const typingUsers = participants.filter(
    (p) => p.typing && p.clientId !== localClientIdRef.current
  );

  /* ------------------ UI ------------------ */
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">

      {/* ================= TOP BAR ================= */}
      <TopBar
        roomId={id}
        participants={participants}
        localClientId={localClientIdRef.current}
        language={language}
        setLanguage={setLanguage}
        LANGUAGES={LANGUAGES}
        runCode={runCode}
        running={running}
        runButtonRef={runButtonRef}
        joinCall={joinCall}
        leaveCall={leaveCall}
        inCall={inCall}
        toggleMic={toggleMic}
        toggleCamera={toggleCamera}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
      />


      {/* ================= MAIN ================= */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT: EDITOR + IO */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">


          <EditorPane
            handleEditorMount={handleEditorMount}
            typingUsers={typingUsers}
          />


          <TerminalPane
            stdin={stdin}
            setStdin={setStdin}
            stdinRef={stdinRef}
            output={output}
          />

        </div>

        {/* RIGHT: VIDEO PANEL */}
        <VideoPanel
          videoOpen={videoOpen}
          setVideoOpen={setVideoOpen}
          localVideoRef={localVideoRef}
          remotePeerIds={remotePeerIds}
          remoteVideosRef={remoteVideosRef}
          peerUsers={peerUsers}
        />


      </div>
    </div>
  );

}
