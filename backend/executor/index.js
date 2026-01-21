import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/run", (req, res) => {
  const { code, language, stdin } = req.body || {};
  if (!code || !language) {
    return res.status(400).json({ error: "Code or language missing" });
  }

  let fileName, dockerImage, runCommand;

  if (language === "javascript") {
    fileName = "main.js";
    dockerImage = "node:18";
    runCommand = ["node", "/app/main.js"];
  } 
  else if (language === "python") {
    fileName = "main.py";
    dockerImage = "python:3.11";
    runCommand = ["python", "/app/main.py"];
  } 
  else if (language === "c") {
    fileName = "main.c";
    dockerImage = "gcc:13";
    runCommand = ["bash", "-lc", "gcc /app/main.c -o /app/main && /app/main"];
  } 
  else if (language === "cpp") {
    fileName = "main.cpp";
    dockerImage = "gcc:13";
    runCommand = ["bash", "-lc", "g++ /app/main.cpp -o /app/main && /app/main"];
  } 
  else {
    return res.status(400).json({ error: "Unsupported language" });
  }

  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-"));
  fs.writeFileSync(path.join(jobDir, fileName), code);

  const docker = spawn(
    "docker",
    [
      "run",
      "--rm",
      "-i",
      "--network=none",
      "-v",
      `${jobDir}:/app`,
      dockerImage,
      ...runCommand
    ]
  );

  let stdout = "";
  let stderr = "";

  docker.stdout.on("data", d => stdout += d.toString());
  docker.stderr.on("data", d => stderr += d.toString());

  docker.on("close", () => {
    fs.rmSync(jobDir, { recursive: true, force: true });
    res.json({ stdout, stderr });
  });

  if (stdin) docker.stdin.write(stdin + "\n");
  docker.stdin.end();
});

app.listen(4000, () => {
  console.log("🚀 Executor running on http://localhost:4000");
});
