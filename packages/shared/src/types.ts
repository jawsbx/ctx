import { verificationToken } from "./crypto.js";

// ---------------------------------------------------------------------------
// MCP content helpers
// ---------------------------------------------------------------------------

export interface TextContent {
  type: "text";
  text: string;
}

export function textContent(text: string): TextContent {
  return { type: "text", text };
}

export function jsonContent(obj: unknown): TextContent {
  return { type: "text", text: JSON.stringify(obj, null, 2) };
}

// ---------------------------------------------------------------------------
// Universal tool response envelope
// ---------------------------------------------------------------------------

export interface ToolResponse<T> {
  success: boolean;
  data: T;
  summary: string;
  verificationToken: string;
  timestamp: string;
  errors: string[];
}

export function buildResponse<T>(data: T, summary: string, errors: string[] = []): ToolResponse<T> {
  const timestamp = new Date().toISOString();
  return {
    success: true,
    data,
    summary,
    verificationToken: verificationToken(data, timestamp),
    timestamp,
    errors,
  };
}

export function buildError<T>(error: string, data: T, errors: string[] = []): ToolResponse<T> {
  const timestamp = new Date().toISOString();
  return {
    success: false,
    data,
    summary: error,
    verificationToken: verificationToken(data, timestamp),
    timestamp,
    errors: [error, ...errors],
  };
}

// ---------------------------------------------------------------------------
// Workflow state machine
// ---------------------------------------------------------------------------

export type StepStatus = "success" | "failed" | "skipped" | "pending";

export interface StepResult<T> {
  status: StepStatus;
  data?: T;
  error?: string;
  durationMs: number;
}

export function pendingStep<T>(): StepResult<T> {
  return { status: "pending", durationMs: 0 };
}

export function skipStep<T>(): StepResult<T> {
  return { status: "skipped", durationMs: 0 };
}

export async function runStep<T>(
  name: string,
  fn: () => Promise<T>
): Promise<StepResult<T>> {
  const start = Date.now();
  try {
    const data = await fn();
    const durationMs = Date.now() - start;
    console.error(`[orchestrator] step "${name}" -> success (${durationMs}ms)`);
    return { status: "success", data, durationMs };
  } catch (e: unknown) {
    const durationMs = Date.now() - start;
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[orchestrator] step "${name}" -> failed (${durationMs}ms): ${error}`);
    return { status: "failed", error, durationMs };
  }
}
