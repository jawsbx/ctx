import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Loads the .env file located in the given server directory.
 * Pass `import.meta.url` from each server's index.ts so that each server
 * only ever loads its own .env — no cross-server env pollution.
 *
 * Usage (inside a server's index.ts):
 *   loadEnv(import.meta.url);
 */
export function loadEnv(importMetaUrl: string): void {
  const dir = path.dirname(fileURLToPath(importMetaUrl));
  // Walk up from src/ to the package root where .env lives
  const packageRoot = path.resolve(dir, "..");
  const envPath = path.join(packageRoot, ".env");
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error(`[env] Warning: could not load .env from ${envPath}: ${result.error.message}`);
  } else {
    console.error(`[env] Loaded .env from ${envPath}`);
  }
}

/**
 * Reads an environment variable and throws a descriptive error if it is missing or empty.
 */
export function requireEnv(key: string, serverName?: string): string {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    const context = serverName ? ` (${serverName} server)` : "";
    throw new Error(
      `Missing required environment variable: ${key}${context}. ` +
        `Check the .env file for this server.`
    );
  }
  return val.trim();
}

/**
 * Reads an environment variable and returns a fallback if not set.
 */
export function optionalEnv(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}
