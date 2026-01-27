import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { getMe } from "./utils/auth.js";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { MonacoBinding } from "y-monaco";

import TopBar from "./components/TopBar.jsx";
import VideoPanel from "./components/VideoPanel.jsx";
import EditorPane from "./components/EditorPane.jsx";
import TerminalPane from "./components/TerminalPane.jsx";
import { useCall } from "./hooks/useCall.js";
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

  const typingTimeoutRef = useRef(null);

  /* ------------------ STATE ------------------ */
  const [language, setLanguage] = useState("javascript");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [videoOpen, setVideoOpen] = useState(true);

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


  const localVideoRef = useRef(null);




  const {
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
  } = useCall(id);


  const handleGitHubLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/github`;
  };






  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamRef.current]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/run`, {
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
      const token = localStorage.getItem("collab_auth_token");
      if (!token) return; // ⛔ DO NOT INIT YET

      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      provider = new HocuspocusProvider({
        url: import.meta.env.VITE_HOCUSPOCUS_URL,
        name: id,
        document: ydoc,
        token,
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
        onLogin={handleGitHubLogin}
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
