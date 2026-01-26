import { spawn, ChildProcess, SpawnOptions } from "child_process";
import path from "path";
import { appendLog, setDeployStatus } from "./status.js";

/**
 * Spawns a node script as a completely detached process.
 * Handles platform-specific differences to ensure the process survives
 * parent termination (e.g. during PM2 restarts).
 */
export function spawnDetachedScript(scriptPath: string): ChildProcess {
  const isWindows = process.platform === "win32";

  console.log(
    `Deploy: Spawning detached script: ${scriptPath} (Windows: ${isWindows})`
  );

  let child: ChildProcess;

  if (isWindows) {
    // Windows: Use 'cmd /c start' to break the process tree completely
    // This ensures the new process is not a child of the current PM2 process group
    child = spawn(
      "cmd.exe",
      [
        "/c",
        "start",
        "/b", // No new window
        "node",
        "--import",
        "tsx", // Use tsx for direct TS execution
        scriptPath,
      ],
      {
        detached: true,
        stdio: "ignore",
        cwd: process.cwd(),
        env: { ...process.env },
        windowsHide: true,
      }
    );
  } else {
    // Linux/Unix: Standard detached spawn
    child = spawn(process.execPath, ["--import", "tsx", scriptPath], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
      env: { ...process.env },
    });
  }

  child.unref();
  return child;
}

export function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} [Deploy] ${message}`;
  console.log(line);
  appendLog(line);
}

export function updateStatus(step: string): void {
  setDeployStatus({ step });
  log(`Status updated: ${step}`);
}

/**
 * Execute a command with real-time log streaming.
 * Captures stdout/stderr and streams to the status file.
 */
export function exec(
  command: string,
  args: string[],
  description: string,
  env?: NodeJS.ProcessEnv
): Promise<void> {
  return new Promise((resolve, reject) => {
    updateStatus(description);
    log(`${description}...`);

    const isWindows = process.platform === "win32";
    const spawnOptions: SpawnOptions = {
      cwd: process.cwd(),
      shell: isWindows,
      env: { ...process.env, FORCE_COLOR: "1", ...env }, // Enable colors for npm
    };

    const child = spawn(command, args, spawnOptions);

    let lastLineOverwritable = false;

    const processOutput = (data: Buffer) => {
      const text = data.toString();
      // Split by newlines but also handle carriage returns for progress bars
      const lines = text.split(/(\r?\n|\r)/);

      for (const line of lines) {
        if (line === "\n" || line === "\r\n" || line === "") continue;

        // Detect if this is a carriage return (overwritable line like npm progress)
        const isOverwritable =
          line === "\r" || (text.includes("\r") && !text.includes("\n"));

        if (line === "\r") {
          lastLineOverwritable = true;
          continue;
        }

        // Keep ANSI codes for colored output in UI/CLI
        const cleanLine = line.trim();
        if (cleanLine) {
          appendLog(line, lastLineOverwritable || isOverwritable);
          console.log(line);
        }
        lastLineOverwritable = false;
      }
    };

    if (child.stdout) {
      child.stdout.on("data", processOutput);
    }

    if (child.stderr) {
      child.stderr.on("data", processOutput);
    }

    child.on("error", (error) => {
      log(`${description} FAILED: ${error.message}`);
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        log(`${description} completed`);
        resolve();
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        log(`${description} FAILED with exit code ${code}`);
        reject(error);
      }
    });
  });
}
