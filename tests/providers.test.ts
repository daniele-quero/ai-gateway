import { describe, expect, it } from "vitest";
import { TemplateProviderClient } from "../netlify/functions/lib/providers/templateProviderClient.js";
import { resolveModel } from "../netlify/functions/lib/providerRegistry.js";
import { resolveCandidates } from "../netlify/functions/lib/models/registry.js";
import { runChat, runChatStream } from "../netlify/functions/lib/chatService.js";
import { sseResponse, type StreamSource } from "../netlify/functions/lib/sse.js";
import { isOriginAllowed, corsHeaders } from "../netlify/functions/lib/cors.js";
import { GatewayError } from "../netlify/functions/lib/errors.js";

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of gen) {
    out.push(chunk);
  }
  return out;
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

describe("TemplateProviderClient", () => {
  const client = new TemplateProviderClient();

  it("is always available", () => {
    expect(client.isAvailable()).toBe(true);
  });

  it("streams tokens", async () => {
    const chunks = await collect(
      client.streamChat({ model: "template", messages: [{ role: "user", content: "hello world" }] }),
    );
    expect(chunks.join("")).toContain("hello world");
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("produces deterministic embeddings", async () => {
    const vectors = await client.embeddings({ model: "template", input: ["a", "bb"] });
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(3);
  });
});

describe("resolveModel", () => {
  it("resolves a concrete template alias", () => {
    const resolved = resolveModel("template-model", "chat");
    expect(resolved[0]?.adapter.id).toBe("template");
  });

  it("registers OpenRouter free aliases without free in their public name", () => {
    const previousKey = process.env.OPENROUTER_FREE_API_KEY;
    process.env.OPENROUTER_FREE_API_KEY = "test-key";

    try {
      const resolved = resolveModel("openrouter-gpt-oss-20b", "chat");
      expect(resolved[0]?.adapter.id).toBe("openrouter-free");
      expect(resolved[0]?.definition.model).toBe("openai/gpt-oss-20b:free");
    } finally {
      if (previousKey === undefined) {
        delete process.env.OPENROUTER_FREE_API_KEY;
      } else {
        process.env.OPENROUTER_FREE_API_KEY = previousKey;
      }
    }
  });

  it("orders auto:balanced from lower to higher expected latency", () => {
    expect(resolveCandidates("auto:balanced")).toEqual([
      "gemini-2-5-flash",
      "gemini-2-5-flash-lite",
      "groq-llama-70b",
      "openrouter-nemotron-3-5-lightning",
      "groq-compound-mini",
      "openrouter-nemotron-3-nano-30b-a3b",
      "openrouter-ling-3-0-tiny",
      "openrouter-lfm-2-5-2-6b",
      "openrouter-nemotron-nano-9b-v2",
      "openrouter-laguna-xs-2-1",
      "openrouter-north-mini-code",
      "openrouter-laguna-s-2-1",
      "openrouter-gpt-oss-20b",
      "openrouter-nemotron-3-nano-omni",
      "openrouter-nemotron-nano-12b-v2-vl",
      "openrouter-gemma-4-26b-a4b",
      "openrouter-gemma-4-31b",
      "openrouter-nemotron-3-super",
      "openrouter-nemotron-3-ultra",
    ]);
  });

  it("throws MODEL_NOT_FOUND for unknown model", () => {
    expect(() => resolveModel("does-not-exist", "chat")).toThrow(GatewayError);
  });
});

describe("chatService with template provider", () => {
  it("returns a non-streaming response", async () => {
    const result = await runChat({
      model: "template-model",
      messages: [{ role: "user", content: "ping" }],
      capability: "chat",
    });
    expect(result.provider).toBe("template");
    expect(result.text).toContain("ping");
  });

  it("builds a stream source with meta and deltas", async () => {
    const source = await runChatStream({
      model: "template-model",
      messages: [{ role: "user", content: "streamed reply" }],
      capability: "streaming",
    });
    expect(source.meta.provider).toBe("template");
    const chunks = await collect(source.deltas);
    expect(chunks.join("")).toContain("streamed reply");
  });
});

describe("sseResponse", () => {
  it("emits meta, delta and done events", async () => {
    async function* deltas(): AsyncGenerator<string> {
      yield "Ciao";
      yield "!";
    }
    const source: StreamSource = { meta: { provider: "p", model: "m" }, deltas: deltas() };
    const body = await readAll(sseResponse(source).body!);
    expect(body).toContain("event: meta");
    expect(body).toContain("event: delta");
    expect(body).toContain('"text":"Ciao"');
    expect(body).toContain("event: done");
  });

  it("emits an error event when the stream fails mid-way", async () => {
    async function* deltas(): AsyncGenerator<string> {
      yield "partial";
      throw new Error("boom");
    }
    const source: StreamSource = { meta: { provider: "p", model: "m" }, deltas: deltas() };
    const body = await readAll(sseResponse(source).body!);
    expect(body).toContain("event: delta");
    expect(body).toContain("event: error");
    expect(body).toContain("UPSTREAM_ERROR");
  });
});

describe("CORS", () => {
  it("allows any origin with wildcard", () => {
    expect(isOriginAllowed("https://a.com", ["*"])).toBe(true);
  });

  it("allows a listed origin and blocks others", () => {
    expect(isOriginAllowed("https://a.com", ["https://a.com"])).toBe(true);
    expect(isOriginAllowed("https://b.com", ["https://a.com"])).toBe(false);
  });

  it("reflects only an allowed origin", () => {
    const allowed = corsHeaders("https://a.com", ["https://a.com"]);
    expect(allowed["Access-Control-Allow-Origin"]).toBe("https://a.com");
    const blocked = corsHeaders("https://b.com", ["https://a.com"]);
    expect(blocked["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
