import type { ProgressEvent } from "@/lib/diligence/types";

/**
 * Reads an NDJSON `ProgressEvent` stream (one JSON object per line) and yields
 * each event as it arrives. Buffers partial lines across chunk boundaries, since
 * a single network chunk may split a line or carry several. Blank lines are the
 * server's keep-alive heartbeat and are skipped.
 */
export async function* readProgressStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ProgressEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line) as ProgressEvent;
      }
    }

    // Flush any trailing line without a terminating newline.
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail) as ProgressEvent;
  } finally {
    reader.releaseLock();
  }
}
