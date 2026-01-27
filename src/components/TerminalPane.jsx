export default function TerminalPane({
  stdin,
  setStdin,
  stdinRef,
  output,
}) {
  return (
    <div className="flex flex-col">

      {/* STDIN */}
      <div className="h-32 border-t border-gray-800 bg-gray-900">
        <textarea
          ref={stdinRef}
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          placeholder="Input…"
          className="w-full h-full p-3 bg-black text-white font-mono text-sm outline-none resize-none"
        />
      </div>

      {/* OUTPUT */}
      <div className="h-48 border-t border-gray-800 bg-black">
        <pre className="h-full p-3 text-green-400 text-sm overflow-auto font-mono whitespace-pre-wrap">
          {output || "▶ Click Run to execute code"}
        </pre>
      </div>

    </div>
  );
}
