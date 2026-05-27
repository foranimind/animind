import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBackendPort(): string | null {
  const portFile = path.resolve(__dirname, "..", "..", "runtime", ".orchestrator-port");
  try {
    const content = fs.readFileSync(portFile, "utf-8").trim();
    if (/^\d{1,5}$/.test(content)) {
      return content;
    }
  } catch {
    return null;
  }
  return null;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const portFromFile = readBackendPort();
  const proxyTarget =
    env.VITE_DEV_PROXY_TARGET ||
    (portFromFile ? `http://localhost:${portFromFile}` : undefined) ||
    "http://localhost:8000";
  const base = env.VITE_BASE && env.VITE_BASE.trim() !== "" ? env.VITE_BASE : "/";

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
        "/assets": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/setupTests.ts",
    },
  };
});
