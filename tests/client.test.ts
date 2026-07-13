import { describe, expect, it } from "vitest";
import { consumeSseStream } from "../src/client/sse.js";
import { createAiGatewayClient } from "../src/client/index.js";
import type { StreamCallbacks } from "../src/client/types.js";

function streamFrom(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe("consumeSseStream", () => {
  it("parses meta, delta and done events", async () => {
    const sse =
      'event: meta\ndata: {"provider":"groq","model":"llama"}\n\n' +
      'event: delta\ndata: {"text":"Ciao"}\n\n' +
      'event: delta\ndata: {"text":"!"}\n\n' +
      "event: done\ndata: {}\n\n";

    const deltas: string[] = [];
    let meta: unknown;
    let done = false;
    const callbacks: StreamCallbacks = {
      onMeta: (m) => (meta = m),
      onDelta: (t) => deltas.push(t),
      onDone: () => (done = true),
    };

    await consumeSseStream(streamFrom(sse), callbacks);

    expect(meta).toEqual({ provider: "groq", model: "llama" });
    expect(deltas.join("")).toBe("Ciao!");
    expect(done).toBe(true);
  });

  it("dispatches an error event", async () => {
    const sse = 'event: error\ndata: {"code":"UPSTREAM_ERROR","message":"boom"}\n\n';
    let error: { code: string; message: string } | undefined;
    await consumeSseStream(streamFrom(sse), { onError: (e) => (error = e) });
    expect(error?.code).toBe("UPSTREAM_ERROR");
  });
});

describe("createAiGatewayClient", () => {
  it("sends the API key and parses a JSON response", async () => {
    let capturedAuth: string | null = null;
    const mockFetch: typeof fetch = async (_url, init) => {
      capturedAuth = new Headers(init?.headers).get("authorization");
      return new Response(JSON.stringify({ provider: "template", model: "m", text: "hi" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = createAiGatewayClient({
      baseUrl: "https://gw.example/api",
      apiKey: "aigw_live_test",
      fetch: mockFetch,
    });

    const result = await client.complete({ model: "auto:fast", input: "hi" });
    expect(result.text).toBe("hi");
    expect(capturedAuth).toBe("Bearer aigw_live_test");
  });

  it("throws AiGatewayError on non-OK responses", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    const client = createAiGatewayClient({
      baseUrl: "https://gw.example/api",
      apiKey: "bad",
      fetch: mockFetch,
    });

    await expect(client.chat({ model: "auto:fast", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("streams via chatStream using a mock SSE response", async () => {
    const sse =
      'event: meta\ndata: {"provider":"template","model":"m"}\n\n' +
      'event: delta\ndata: {"text":"Hello"}\n\n' +
      "event: done\ndata: {}\n\n";
    const mockFetch: typeof fetch = async () =>
      new Response(streamFrom(sse), { status: 200, headers: { "Content-Type": "text/event-stream" } });

    const client = createAiGatewayClient({
      baseUrl: "https://gw.example/api",
      apiKey: "k",
      fetch: mockFetch,
    });

    const deltas: string[] = [];
    await client.chatStream(
      { model: "auto:fast", messages: [{ role: "user", content: "x" }] },
      { onDelta: (t) => deltas.push(t) },
    );
    expect(deltas.join("")).toBe("Hello");
  });
});
