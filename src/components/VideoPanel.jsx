export default function VideoPanel({
  videoOpen,
  setVideoOpen,
  localVideoRef,
  remotePeerIds,
  remoteVideosRef,
  peerUsers,
}) {
  return (
    <aside
      className={`relative h-full border-l border-gray-800 bg-gray-900
        transition-[max-width] duration-300 ease-in-out
        ${videoOpen ? "max-w-[18rem]" : "max-w-[3rem]"}
        flex-shrink-0 overflow-hidden
      `}
    >
      {/* TOGGLE HANDLE */}
      <button
        onClick={() => setVideoOpen((v) => !v)}
        className="absolute left-0 top-1/2 -translate-y-1/2
          z-50
          w-6 h-14
          bg-gray-800 border-r border-gray-700
          rounded-r-md
          flex items-center justify-center
          text-gray-300 hover:bg-gray-700 hover:text-white
          transition"
      >
        {videoOpen ? "›" : "‹"}
      </button>

      {/* CONTENT */}
      <div className="h-full flex flex-col p-3 pl-6 gap-3 overflow-y-auto">

        <div className="text-sm text-gray-400">🎥 Call</div>

        {/* LOCAL VIDEO */}
        <div className="relative">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video rounded-lg bg-black object-cover"

          />
          <span className="absolute bottom-1 left-1 bg-black/70 text-xs px-2 py-0.5 rounded">
            You
          </span>
        </div>

        {/* REMOTE VIDEOS */}
        {remotePeerIds.map((peerId) => (
          <div key={peerId} className="relative">
            <video
              ref={(el) => el && (remoteVideosRef.current[peerId] = el)}
              autoPlay
              playsInline
              className="w-full aspect-video rounded-lg bg-black object-cover"
            />
            <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur flex items-center gap-1 px-2 py-0.5 rounded text-xs">
              {peerUsers[peerId]?.avatar && (
                <img
                  src={peerUsers[peerId].avatar}
                  className="w-4 h-4 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              {peerUsers[peerId]?.name || "User"}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
