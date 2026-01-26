import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
const socketUsers = new Map(); // socketId -> { name, avatar }

dotenv.config();


const app = express();
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

const activeCalls = new Map(); // roomId -> Set(socketId)

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token"));

  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});
io.on("connect_error", (err) => {
  console.error("❌ Socket connect error:", err.message);
});


io.on("connection", (socket) => {
  socket.on("join-call", ({ roomId , user}) => {
    console.log("📞 join-call", socket.id, roomId);
    socketUsers.set(socket.id, user);
    if (!activeCalls.has(roomId)) {
      activeCalls.set(roomId, new Set());
    }

    const room = activeCalls.get(roomId);

    const peers = Array.from(room);
    room.add(socket.id);

    socket.join(roomId);

    socket.emit("call-peers", peers);

    socket.to(roomId).emit("user-joined-call", socket.id);
  });


  socket.on("offer", ({ to, sdp }) => {
    console.log("📨 offer", socket.id, "→", to);
    io.to(to).emit("offer", {
  from: socket.id,
  sdp,
  user: socketUsers.get(socket.id),
});

  });

  socket.on("answer", ({ to, sdp }) => {
    console.log("📩 answer", socket.id, "→", to);
    io.to(to).emit("answer", {
  from: socket.id,
  sdp,
  user: socketUsers.get(socket.id),
});

  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    console.log("🧊 ice", socket.id, "→", to);
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("leave-call", ({ roomId }) => {
    activeCalls.get(roomId)?.delete(socket.id);
    socket.to(roomId).emit("user-left-call", socket.id);
  });

  socket.on("disconnect", () => {
    for (const [roomId, set] of activeCalls.entries()) {
      if (set.delete(socket.id)) {
        socket.to(roomId).emit("user-left-call", socket.id);
      }
    }
  });
});

server.listen(5002, () => {
  console.log("🎥 WebRTC signaling server on http://localhost:5002");
});
