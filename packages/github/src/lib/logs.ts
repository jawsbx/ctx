import AdmZip from "adm-zip";
import { buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { LogEntry } from "./types.js";

/**
 * Extracts all .txt log entries from a GitHub Actions log zip buffer.
 * No temp files are written — extraction is fully in-memory.
 */
export function extractLogsFromZip(
  zipBuffer: Buffer,
  fileFilter?: string
): ToolResponse<LogEntry[]> {
  console.error(`[github/logs] Extracting zip (${zipBuffer.byteLength} bytes)${fileFilter ? ` filter="${fileFilter}"` : ""}`);
  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    console.error(`[github/logs] Zip contains ${entries.length} entries`);

    const logs: LogEntry[] = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName;
      if (fileFilter && !name.toLowerCase().includes(fileFilter.toLowerCase())) continue;
      const content = zip.readAsText(entry);
      logs.push({ fileName: name, content });
      console.error(`[github/logs] Extracted: ${name} (${content.length} chars)`);
    }

    return buildResponse(logs, `Extracted ${logs.length} log file(s) from zip.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to extract log zip: ${msg}`, []);
  }
}

/**
 * Finds the log entry whose filename contains "Deploy Trigger Stage" (case-insensitive).
 */
export function findDeployTriggerStageLog(entries: LogEntry[]): ToolResponse<LogEntry | null> {
  console.error(`[github/logs] Searching ${entries.length} entries for "Deploy Trigger Stage"`);
  const found = entries.find((e) =>
    e.fileName.toLowerCase().includes("deploy trigger stage")
  ) ?? null;
  if (found) {
    console.error(`[github/logs] Found: ${found.fileName}`);
    return buildResponse(found, `Found Deploy Trigger Stage log: ${found.fileName}`);
  }
  console.error("[github/logs] Deploy Trigger Stage log not found");
  return buildResponse(null, "No Deploy Trigger Stage log entry found in zip.");
}

/**
 * Extracts the JSON payload object from a log line matching:
 *   Payload: { ... }
 * Uses regex to locate the start of the object, then validates with JSON.parse.
 */
export function extractPayloadObject(
  logContent: string
): ToolResponse<Record<string, unknown> | null> {
  console.error("[github/logs] Searching for Payload: object in log content");
  try {
    // Match "Payload:" followed by a JSON object (non-greedy brace matching via scan)
    const payloadIdx = logContent.search(/Payload\s*:/i);
    if (payloadIdx === -1) {
      console.error("[github/logs] No 'Payload:' marker found");
      return buildResponse(null, "No 'Payload:' marker found in log content.");
    }

    // Find the opening brace after "Payload:"
    const braceStart = logContent.indexOf("{", payloadIdx);
    if (braceStart === -1) {
      return buildResponse(null, "'Payload:' found but no '{' follows it.");
    }

    // Scan forward to find the matching closing brace
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < logContent.length; i++) {
      if (logContent[i] === "{") depth++;
      else if (logContent[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) {
      return buildError("Found 'Payload: {' but could not find matching closing brace.", null);
    }

    const rawMatch = logContent.slice(braceStart, end + 1);
    console.error(`[github/logs] Raw payload match: ${rawMatch.slice(0, 100)}...`);

    const parsed = JSON.parse(rawMatch) as Record<string, unknown>;
    console.error(`[github/logs] Payload parsed OK. Keys: ${Object.keys(parsed).join(", ")}`);

    return buildResponse(parsed, `Payload object extracted successfully. Keys: ${Object.keys(parsed).join(", ")}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to extract payload object: ${msg}`, null);
  }
}

/**
 * Filters log lines to those containing a search string. Useful for surfacing errors.
 */
export function filterLogLines(content: string, filter: string): string[] {
  return content.split("\n").filter((line) => line.toLowerCase().includes(filter.toLowerCase()));
}
