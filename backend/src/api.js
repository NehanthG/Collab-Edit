import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import { runCode } from "../executor/index.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "200kb" }));

// 🔐 OAuth
app.use("/auth", authRoutes);

// 🧪 Code execution
app.post("/run", runCode);

app.listen(4000, () => {
  console.log("🚀 API server running on http://localhost:4000");
});
