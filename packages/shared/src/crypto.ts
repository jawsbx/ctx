import crypto from "crypto";

/**
 * Computes a sha256 verification token over the given data + current timestamp.
 * Callers should store the timestamp alongside the token for replay detection.
 */
export function verificationToken(data: unknown, timestamp: string): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(data) + timestamp)
    .digest("hex")
    .slice(0, 16); // 16-char prefix — sufficient for LLM verification UX
}
