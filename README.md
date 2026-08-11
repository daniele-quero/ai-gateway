# AI Gateway

Reusable AI Gateway deployable on **Netlify Functions**. It centralizes calls to
multiple AI providers behind a small, API-key–protected HTTP surface, supports
text and multimodal (image) requests, streams responses via SSE, and ships an
exportable TypeScript client for reuse across personal projects.

See [PLAN.md](PLAN.md) for the full architecture and rationale.

## Features

- Public, API-key–protected endpoints: `chat`, `complete`, `vision`, `embeddings`, `providers`, `model/<alias>`.
- Admin-protected app key management: create, list, revoke, rotate.
- App API keys stored **only as peppered hashes**; plaintext shown once at creation.
- Provider adapters behind a shared contract: Google Gemini, Groq, OpenRouter Free, plus a deterministic `template` provider for tests.
- Centralized model registry with routing aliases: `auto:fast`, `auto:balanced`, `auto:quality`, `auto:reasoning`, `auto:vision`, `auto:embedding`.
- SSE streaming with `meta` / `delta` / `done` / `error` events and provider fallback before the first token.
- Per-app CORS allowlists and per-app rate limits.
- Exportable ESM TypeScript client with SSE parsing, `AbortSignal` support and normalized errors.

## Requirements

- Node.js 20+
- A Netlify account for deployment (Netlify Blobs is used for key storage).

## Local setup

```bash
npm install
cp .env.example .env   # fill in secrets
npm run test
npm run lint
npm run build
npx --yes netlify@26.1.0 dev --offline
```

The local dev server exposes the API under `/api/*`.

## Environment variables

See [.env.example](.env.example). Summary:

| Variable | Purpose |
| --- | --- |
| `AI_GATEWAY_ADMIN_KEY` | Protects key-management endpoints |
| `AI_GATEWAY_KEY_PEPPER` | Long random secret used to hash app API keys |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `GROQ_API_KEY` | Groq API key |
| `OPENROUTER_FREE_API_KEY` | OpenRouter API key for free-tier models |
| `OPENAI_API_KEY` | Reserved for an OpenAI adapter |
| `NETLIFY_BLOBS_CONTEXT` | Netlify Blobs context |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optional production rate-limit store |
| `FIRST_TOKEN_TIMEOUT_MS` / `OVERALL_TIMEOUT_MS` | Streaming timeouts |

Provider secrets never leave the server and are never returned by any API.

## Deploy to Netlify

1. Push this repository to your Git provider and create a Netlify site from it.
2. Set the environment variables above in **Site settings → Environment variables**.
3. Netlify uses [netlify.toml](netlify.toml): build command `npm run build`, functions in `netlify/functions`.
4. Endpoints are served under `/api/*`.

## Creating an app API key

Key-management endpoints require the admin key:

```bash
curl -X POST https://<site>.netlify.app/api/keys \
  -H "Authorization: Bearer $AI_GATEWAY_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "resume-pwa",
    "label": "Most Badass Resume Ever",
    "allowedOrigins": ["https://example.netlify.app", "http://localhost:5173"],
    "limits": { "requestsPerMinute": 10, "requestsPerDay": 200 },
    "enabledCapabilities": ["chat", "complete", "vision", "embeddings"]
  }'
```

The plaintext `apiKey` in the response is shown **once**. Store it immediately.

List keys (no secrets returned):

```bash
curl https://<site>.netlify.app/api/keys -H "Authorization: Bearer $AI_GATEWAY_ADMIN_KEY"
```

Revoke a key:

```bash
curl -X POST https://<site>.netlify.app/api/keys/revoke \
  -H "Authorization: Bearer $AI_GATEWAY_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "keyId": "key_..." }'
```

## Calling the API

Health (public, no auth):

```bash
curl https://<site>.netlify.app/api/health
```

Chat (app API key required):

```bash
curl -X POST https://<site>.netlify.app/api/chat \
  -H "Authorization: Bearer aigw_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto:fast",
    "messages": [{ "role": "user", "content": "Ciao" }],
    "stream": false
  }'
```

Set `"stream": true` to receive SSE events (`meta`, `delta`, `done`, `error`).

## Using the TypeScript client

```ts
import { createAiGatewayClient } from "@personal/ai-gateway/client";

const ai = createAiGatewayClient({
  baseUrl: "https://<site>.netlify.app/api",
  apiKey: import.meta.env.VITE_AI_GATEWAY_KEY,
});

// Non-streaming
const reply = await ai.complete({ model: "auto:fast", input: "Riassumi questo testo" });

// Streaming
await ai.chatStream(
  { model: "auto:fast", messages: [{ role: "user", content: "Ciao" }] },
  {
    onMeta: (meta) => console.log(meta),
    onDelta: (text) => process.stdout.write(text),
    onDone: () => console.log("\n[done]"),
    onError: (err) => console.error(err),
  },
);

// Vision
await ai.vision({
  model: "auto:vision",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Descrivi questa immagine" },
        { type: "image_url", imageUrl: "https://example.com/image.png" },
      ],
    },
  ],
});
```

## Adding a new provider

1. Create `netlify/functions/lib/providers/<name>Client.ts` implementing `ProviderAdapter` from [providers/types.ts](netlify/functions/lib/providers/types.ts). Copy [templateProviderClient.ts](netlify/functions/lib/providers/templateProviderClient.ts) as a starting point. For OpenAI-compatible APIs reuse [openaiCompatible.ts](netlify/functions/lib/providers/openaiCompatible.ts).
2. Register the adapter in `ADAPTERS` in [providerRegistry.ts](netlify/functions/lib/providerRegistry.ts) and add its `ProviderId` in [models/registry.ts](netlify/functions/lib/models/registry.ts).
3. Read the provider secret via [config.ts](netlify/functions/lib/config.ts) — never hardcode it.

## Adding a new model

Add an entry to `MODEL_REGISTRY` in [models/registry.ts](netlify/functions/lib/models/registry.ts) with its `provider`, provider-native `model`, `capabilities` and `defaultMaxOutputTokens`. Optionally reference it from a routing alias in `ROUTES`.

OpenRouter Free aliases are prefixed with `openrouter-` and omit `free`, for example `openrouter-gpt-oss-20b`. Their provider-native IDs retain `:free` so requests stay on the free tier. The registry includes the requested chat, vision and embedding models; inspect `/api/providers` to discover the full current alias list.

## Security notes

- Provider secrets live only in Netlify environment variables and are never returned or logged.
- App API keys are stored only as peppered SHA-256 hashes; the plaintext is shown once.
- Every endpoint except `/api/health` requires an app key; key management requires the admin key.
- CORS origins are validated per app key before being reflected.
- Prompts, base64 image payloads, keys and provider tokens are never logged.

## Known limitations (v1)

- Rate limiting uses an in-memory store by default (per-instance). Use a shared store (e.g. Upstash) in production.
- Exact production model lists are a starting template and expected to evolve.
- Text-to-speech and reranking endpoints are not part of the v1 gateway contract. Therefore Fish Audio S2.1 Pro Free and Llama Nemotron Rerank VL 1B V2 are not exposed until those endpoint types are implemented.
- No dashboard, billing, multi-tenant public access, WebSocket, fine-tuning or vector storage in v1.

## Scripts

| Command | Description |
| --- | --- |
| `npm run test` | Run the Vitest suite |
| `npm run lint` | Lint with ESLint |
| `npm run build` | Compile functions and client |
| `npm run build:client` | Compile only the exportable client |
| `npm run typecheck` | Type-check without emitting |
| `npm run dev` | Netlify dev server |
