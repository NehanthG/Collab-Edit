import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import { runCode } from "../executor/index.js";
import { initRTC } from "./rtc.js";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "https://collab-edit-mu.vercel.app",
  "https://collab-edit-nehanthgs-projects.vercel.app",
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
}));

app.use(express.json({ limit: "200kb" }));

app.use("/auth", authRoutes);
app.post("/run", runCode);

// 👇 THIS IS THE KEY LINE
initRTC(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 API + RTC server running on port ${PORT}`);
});
