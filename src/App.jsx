import { useNavigate } from "react-router-dom";

function App() {
  const navigate = useNavigate();

  function createRoom() {
    const id = Math.random().toString(36).substring(2, 10);
    navigate(`/room/${id}`);
  }

  return (
    <div className="h-screen bg-gray-900 flex justify-center items-center">
      <button
        onClick={createRoom}
        className="px-6 py-3 bg-blue-600 text-white text-xl rounded-lg hover:bg-blue-700 transition"
      >
        Create Room
      </button>
    </div>
  );
}

export default App;
