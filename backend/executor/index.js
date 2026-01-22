import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(cors());

const TIMEOUT_MS = 3000;

app.post("/run", (req, res) => {
  const { code, language, stdin } = req.body || {};

  if (!code || !language) {
    res.status(400).end("Code or language missing");
    return;
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
    runCommand = ["bash", "-lc", "gcc /app/main.c -o /tmp/main && /tmp/main"];
  }
  else if (language === "cpp") {
    fileName = "main.cpp";
    dockerImage = "gcc:13";
    runCommand = ["bash", "-lc", "g++ /app/main.cpp -o /tmp/main && /tmp/main"];
  }
  else {
    res.status(400).end("Unsupported language");
    return;
  }

  // 🔹 Enable streaming
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-"));
  fs.writeFileSync(path.join(jobDir, fileName), code);

  const docker = spawn("docker", [
    "run",
    "--rm",
    "-i",
    "--network=none",
    "--cpus=0.5",
    "--memory=256m",
    "--pids-limit=64",
    "--ulimit", "cpu=2",
    "--ulimit", "fsize=1048576",
    "--security-opt", "no-new-privileges",
    "-v", `${jobDir}:/app:ro`,
    dockerImage,
    ...runCommand
  ]);

  let killedByTimeout = false;

  const timer = setTimeout(() => {
    killedByTimeout = true;
    docker.kill("SIGKILL");
  }, TIMEOUT_MS);

  // 🔥 STREAM OUTPUT LIVE
  docker.stdout.on("data", chunk => {
    res.write(chunk);
  });

  docker.stderr.on("data", chunk => {
    res.write(chunk);
  });

  docker.on("close", (exitCode) => {
    clearTimeout(timer);
    fs.rmSync(jobDir, { recursive: true, force: true });

    if (killedByTimeout) {
      res.write("\n⛔ Time Limit Exceeded\n");
    } else if (exitCode !== 0) {
      res.write(`\n❌ Process exited with code ${exitCode}\n`);
    } else {
      res.write("\n✅ Execution finished\n");
    }

    res.end();
  });

  if (stdin) {
    docker.stdin.write(stdin);
  }
  docker.stdin.end();
});

app.listen(4000, () => {
  console.log("🚀 Executor running on http://localhost:4000");
});
