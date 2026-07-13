/**
 * Minimal SSE parser for the gateway's streaming responses.
 * Consumes a ReadableStream and dispatches meta/delta/done/error events.
 */

import type { StreamCallbacks, StreamMeta } from "./types.js";

interface ParsedEvent {
  event: string;
  data: string;
}

function parseBlock(block: string): ParsedEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return { event, data: dataLines.join("\n") };
}

/**
 * Reads an SSE stream and invokes the matching callbacks.
 * Resolves when the stream ends (after done/error or EOF).
 */
export async function consumeSseStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: StreamCallbacks,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (parsed: ParsedEvent): void => {
    switch (parsed.event) {
      case "meta":
        callbacks.onMeta?.(JSON.parse(parsed.data) as StreamMeta);
        break;
      case "delta": {
        const { text } = JSON.parse(parsed.data) as { text: string };
        callbacks.onDelta?.(text);
        break;
      }
      case "done":
        callbacks.onDone?.();
        break;
      case "error":
        callbacks.onError?.(JSON.parse(parsed.data) as { code: string; message: string });
        break;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const parsed = parseBlock(block);
        if (parsed) {
          dispatch(parsed);
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }
    // Flush any trailing block without a terminating separator.
    const trailing = parseBlock(buffer);
    if (trailing) {
      dispatch(trailing);
    }
  } finally {
    reader.releaseLock();
  }
}
