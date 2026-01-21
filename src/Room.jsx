import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";

import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { MonacoBinding } from "y-monaco";

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

export default function Room() {
  const { id } = useParams();

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

  const errorDecorationIdsRef = useRef([]);
  const remoteDecorationIdsRef = useRef([]);
  const isDecoratingRef = useRef(false);

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
  function runCode() {
    if (!editorRef.current) return;

    setRunning(true);
    setOutput("");

    errorDecorationIdsRef.current = editorRef.current.deltaDecorations(
      errorDecorationIdsRef.current,
      []
    );

    const code = editorRef.current.getValue();

    const needsInput =
      /scanf\s*\(|cin\s*>>|input\s*\(/.test(code);

    if (needsInput && stdin.trim() === "") {
      setOutput(
        "⚠️ This program expects input.\n\nPlease provide stdin before running."
      );
      setRunning(false);
      return;
    }


    fetch("http://localhost:4000/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: editorRef.current.getValue(),
        language,
        stdin,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const terminalText = formatTerminalOutput(
          stdin,
          data.stdout,
          data.stderr
        );

        setOutput(terminalText);

        setTimeout(() => {
          applyErrorsToMonaco(data.stderr, language);
        }, 0);
      })
      .finally(() => setRunning(false));
  }

  /* ------------------ PROVIDER ------------------ */
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new HocuspocusProvider({
      url: "ws://localhost:1234",
      name: id,
      document: ydoc,
    });

    providerRef.current = provider;

    provider.awareness.setLocalState({
      user: {
        name: "User-" + Math.floor(Math.random() * 10000),
        color: "#" + Math.floor(Math.random() * 0xffffff).toString(16),
      },
    });

    provider.awareness.on("change", rebuildRemoteDecorations);

    return () => {
      provider.destroy();
      ydoc.destroy();
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

  /* ------------------ UI ------------------ */
  return (
  <div className="h-screen flex flex-col bg-gray-950">

    {/* TOP BAR */}
    <div className="p-4 bg-gray-800 text-white flex justify-between">
      <h2>Room: {id}</h2>

      <div className="flex gap-4">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-gray-700 px-3 py-1 rounded"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <button
          onClick={runCode}
          disabled={running}
          className="bg-green-600 px-4 py-1 rounded"
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>
    </div>

    {/* MAIN */}
    <div className="flex-1 flex flex-col min-h-0">

      {/* EDITOR */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          theme="vs-dark"
          defaultLanguage="javascript"
          onMount={handleEditorMount}
        />
      </div>

      {/* STDIN */}
      <div className="h-32 bg-gray-900 border-t border-gray-700 flex flex-col">
        {/* <div className="px-3 py-1 text-xs text-gray-400 border-b border-gray-700">
          💡 Non-interactive stdin (like Codeforces / LeetCode)
        </div> */}
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          placeholder="Example:\n5\n10\nhello"
          className="flex-1 p-3 bg-black text-white font-mono text-sm outline-none resize-none"
        />
      </div>

      {/* TERMINAL */}
      <div className="h-48 bg-black border-t border-gray-700">
        <pre className="h-full p-3 text-green-400 text-sm overflow-auto font-mono whitespace-pre-wrap">
          {output || "▶ Click Run to execute code"}
        </pre>
      </div>

    </div>
  </div>
);

}
