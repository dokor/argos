import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.PORT || 3010);
const maxConcurrency = Math.max(1, Number(process.env.CODEX_MAX_CONCURRENCY || 1));
const timeoutMs = Math.max(10_000, Number(process.env.CODEX_TIMEOUT_MS || 90_000));
const maxBodyBytes = Math.max(1024, Number(process.env.CODEX_MAX_BODY_BYTES || 262_144));

let activeRuns = 0;

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function runCodexProcess(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        const error = new Error("Codex execution timed out.");
        error.statusCode = 504;
        reject(error);
        return;
      }

      if (code !== 0) {
        const error = new Error("Codex execution failed.");
        error.statusCode = 502;
        error.details = stderr.trim() || stdout.trim();
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function execute({ prompt, schema }) {
  const dir = await mkdtemp(join(tmpdir(), "argos-codex-"));
  const outputPath = join(dir, "result.json");
  const args = ["exec", "--sandbox", "read-only", "--ephemeral"];

  try {
    if (schema) {
      const schemaPath = join(dir, "schema.json");
      await writeFile(schemaPath, JSON.stringify(schema), "utf8");
      args.push("--output-schema", schemaPath);
    }

    args.push("-o", outputPath, prompt);
    await runCodexProcess(args, "/workspace");

    const output = (await readFile(outputPath, "utf8")).trim();
    return {
      output,
      structuredOutput: schema ? JSON.parse(output) : null,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, activeRuns, maxConcurrency });
      return;
    }

    if (req.method === "POST" && req.url === "/run") {
      if (activeRuns >= maxConcurrency) {
        sendJson(res, 429, { ok: false, error: "busy" });
        return;
      }

      const body = await readJson(req);
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

      if (!prompt) {
        sendJson(res, 400, { ok: false, error: "prompt is required" });
        return;
      }

      activeRuns += 1;
      try {
        const result = await execute({ prompt, schema: body.schema });
        sendJson(res, 200, { ok: true, ...result });
      } finally {
        activeRuns -= 1;
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  } catch (error) {
    sendJson(res, Number(error.statusCode) || 500, {
      ok: false,
      error: error.message || "internal_error",
      details: error.details || undefined,
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`argos codex-summary listening on :${port}`);
});
