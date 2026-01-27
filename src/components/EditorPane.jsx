import Editor from "@monaco-editor/react";

export default function EditorPane({
  handleEditorMount,
  typingUsers,
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">

      {/* EDITOR */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          theme="vs-dark"
          defaultLanguage="javascript"
          onMount={handleEditorMount}
        />
      </div>

      {/* TYPING INDICATOR */}
      <div
        className={`px-4 py-1 text-sm italic text-gray-400 transition-opacity
          ${typingUsers.length ? "opacity-100" : "opacity-0"}
        `}
      >
        {typingUsers.length === 1
          ? `${typingUsers[0].name} is typing`
          : `${typingUsers.length} people are typing`}
        <span className="typing-dots" />
      </div>

    </div>
  );
}
