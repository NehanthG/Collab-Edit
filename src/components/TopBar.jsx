export default function TopBar({
  roomId,
  participants,
  localClientId,
  language,
  setLanguage,
  LANGUAGES,
  runCode,
  running,
  runButtonRef,
  joinCall,
  leaveCall,
  inCall,
  toggleMic,
  toggleCamera,
  micEnabled,
  cameraEnabled,
}) {
  return (
    <header className="h-16 px-6 flex items-center justify-between bg-gray-900 border-b border-gray-800">

      {/* LEFT */}
      <div className="flex items-center gap-6">
        <div>
          <div className="text-xs text-gray-400">Room</div>
          <div className="font-semibold">{roomId}</div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">👥 {participants.length}</span>

          <div className="flex -space-x-2">
            {participants.map((p) => {
              const isYou = p.clientId === localClientId;

              return (
                <div
                  key={p.clientId}
                  className="relative group w-8 h-8 rounded-full border-2 border-gray-900 overflow-hidden"
                  style={{ backgroundColor: p.color }}
                >
                  {p.avatar ? (
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-black">
                      {p.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}

                  <div className="absolute hidden group-hover:block bottom-10 left-1/2 -translate-x-1/2
                    bg-black text-xs px-2 py-1 rounded whitespace-nowrap">
                    {p.name} {isYou && "(You)"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CENTER */}
      <div className="flex items-center gap-3 bg-gray-800 px-3 py-1.5 rounded-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={joinCall}
            disabled={inCall}
            className={`px-3 py-1.5 rounded-md text-sm
            ${inCall ? "bg-gray-700" : "bg-blue-600 hover:bg-blue-500"}`}
          >
            {inCall ? "In Call" : "Join Call"}
          </button>

          <button
            onClick={leaveCall}
            disabled={!inCall}
            className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-sm disabled:opacity-50"
          >
            Leave
          </button>

          <div className="w-px h-6 bg-gray-700" />

          <button
            onClick={toggleMic}
            disabled={!inCall}
            className={`px-3 py-1.5 rounded-md text-sm
            ${micEnabled ? "bg-gray-700" : "bg-red-600"}`}
          >
            {micEnabled ? "🎙️" : "🔇"}
          </button>

          <button
            onClick={toggleCamera}
            disabled={!inCall}
            className={`px-3 py-1.5 rounded-md text-sm
            ${cameraEnabled ? "bg-gray-700" : "bg-red-600"}`}
          >
            {cameraEnabled ? "📷" : "🚫"}
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3 bg-gray-800 px-3 py-1.5 rounded-lg">
        <div className="flex items-center gap-4">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-700 px-3 py-1.5 rounded-md text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>

          <button
            ref={runButtonRef}
            onClick={runCode}
            disabled={running}
            className={`px-4 py-1.5 rounded-md text-sm
            ${running ? "bg-green-700" : "bg-green-600 hover:bg-green-500"}`}
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>
    </header>
  );
}
