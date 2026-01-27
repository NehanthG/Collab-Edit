import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import { runCode } from "../executor/index.js";
import "dotenv/config";

const app = express();

// ✅ CORS (safe for now, tighten later)
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "200kb" }));

// 🩺 Health check (VERY IMPORTANT)
app.get("/health", (_, res) => {
  res.send("OK");
});

// 🔐 OAuth
app.use("/auth", authRoutes);

// 🧪 Code execution
app.post("/run", runCode);

// ✅ Render-compatible port
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
});
