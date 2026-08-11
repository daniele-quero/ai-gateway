# AI Gateway Netlify - Implementation Plan

## 1. Obiettivo

Creare un microservizio AI Gateway deployabile su Netlify, pensato per essere riusato da piu progetti personali.

Il gateway deve:
- centralizzare le chiamate ai provider AI;
- esporre poche API pubbliche ma protette da API key;
- supportare chiamate testuali e multimodali con immagini;
- usare streaming quando il provider lo consente;
- gestire secret provider-side senza esporli ai client;
- permettere la creazione, storage e revoca di API key per le app personali;
- offrire un'interfaccia TypeScript facilmente esportabile/importabile negli altri progetti.

Il progetto deve essere una base estendibile: per iniziare implementare template e struttura, non una lista definitiva di tutti i modelli.

---

## 2. Vincoli Principali

- Deploy target: Netlify.
- Runtime: Node.js 20+.
- Linguaggio: TypeScript strict.
- Backend: Netlify Functions.
- Nessun secret hardcoded.
- Le API sono pubbliche su internet ma richiedono API key.
- Le API key delle app personali devono essere generate dal gateway e salvate in modo sicuro.
- Le API key dei provider esterni devono stare solo in Netlify environment variables.
- Lo streaming deve essere usato ogni volta che il provider lo supporta.
- Il gateway deve poter essere consumato facilmente da altri progetti tramite client TypeScript esportabile.

---

## 3. Architettura Target

```txt
App personale
  -> AI Gateway Netlify Function
    -> Provider adapter
      -> Google Gemini / Groq / altri provider futuri
```

Evitare questo schema quando possibile:

```txt
App personale
  -> backend app personale
    -> AI Gateway
      -> Provider
```

Le app frontend devono poter chiamare direttamente il gateway usando una API key specifica per app.

---

## 4. Struttura Progetto Consigliata

```txt
ai-gateway/
  netlify.toml
  package.json
  tsconfig.json
  README.md
  .env.example

  netlify/
    functions/
      chat.ts
      complete.ts
      model.ts
      vision.ts
      embeddings.ts
      providers.ts
      keys.ts
      health.ts

      lib/
        auth.ts
        cors.ts
        errors.ts
        sse.ts
        validation.ts
        config.ts
        rateLimit.ts
        keyStore.ts
        providerRegistry.ts

        providers/
          types.ts
          geminiClient.ts
          groqClient.ts
          templateProviderClient.ts

        models/
          registry.ts
          templates.ts

  src/
    client/
      index.ts
      types.ts
      sse.ts
      errors.ts

  tests/
    auth.test.ts
    validation.test.ts
    providers.test.ts
    client.test.ts

  docs/
    api.md
    providers.md
    deployment.md
    security.md
```

---

## 5. Netlify Configuration

`netlify.toml` deve configurare Functions e redirect API.

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

Il progetto puo non avere frontend reale. Se serve solo gateway, `dist` puo contenere una pagina statica minimale con documentazione o health page.

---

## 6. Secret e Environment Variables

### Provider secrets

```txt
GOOGLE_API_KEY=...
GROQ_API_KEY=...
OPENAI_API_KEY=...
```

### Gateway admin secrets

```txt
AI_GATEWAY_ADMIN_KEY=...
AI_GATEWAY_KEY_PEPPER=...
```

### Storage config

Per una v1 Netlify-native:

```txt
NETLIFY_BLOBS_CONTEXT=production
```

Per rate limit o storage piu robusto, opzionale:

```txt
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### Regole

- Le API key provider non devono mai essere restituite dalle API.
- Le app personali ricevono solo API key del gateway.
- Le API key gateway devono essere salvate solo come hash, non in chiaro.
- Il valore in chiaro va mostrato una sola volta alla creazione.

---

## 7. Autorizzazione API Pubbliche

Tutte le API pubbliche, eccetto `/api/health`, devono richiedere:

```http
Authorization: Bearer <gateway_app_api_key>
```

oppure, in alternativa supportata:

```http
X-AI-Gateway-Key: <gateway_app_api_key>
```

La validazione deve:
- estrarre la key;
- calcolarne hash con `AI_GATEWAY_KEY_PEPPER`;
- cercarla nello storage;
- verificare stato `active`;
- associare la richiesta a `appId`;
- applicare eventuali limiti per app.

---

## 8. API Per Gestione API Key App

Queste API servono a creare, archiviare, listare e revocare API key da consegnare agli altri progetti personali.

Devono essere protette da admin key:

```http
Authorization: Bearer <AI_GATEWAY_ADMIN_KEY>
```

### `POST /api/keys`

Crea una API key per una nuova app.

Request:

```json
{
  "appId": "resume-pwa",
  "label": "Most Badass Resume Ever",
  "allowedOrigins": [
    "https://example.netlify.app",
    "http://localhost:5173"
  ],
  "limits": {
    "requestsPerMinute": 10,
    "requestsPerDay": 200
  },
  "enabledCapabilities": [
    "chat",
    "complete",
    "vision",
    "embeddings"
  ]
}
```

Response:

```json
{
  "appId": "resume-pwa",
  "keyId": "key_...",
  "apiKey": "aigw_live_...",
  "warning": "Store this key now. It will not be shown again."
}
```

### `GET /api/keys`

Lista le key registrate, senza mostrare il valore segreto.

Response:

```json
{
  "keys": [
    {
      "keyId": "key_...",
      "appId": "resume-pwa",
      "label": "Most Badass Resume Ever",
      "status": "active",
      "createdAt": "2026-07-09T00:00:00.000Z",
      "lastUsedAt": "2026-07-09T00:00:00.000Z",
      "allowedOrigins": ["https://example.netlify.app"]
    }
  ]
}
```

### `POST /api/keys/revoke`

Revoca una key.

Request:

```json
{
  "keyId": "key_..."
}
```

Response:

```json
{
  "ok": true
}
```

### `POST /api/keys/rotate`

Crea una nuova key per la stessa app e marca la vecchia come `rotating` o `revoked`.

Request:

```json
{
  "keyId": "key_...",
  "revokeOldImmediately": false
}
```

---

## 9. Storage API Key

Per Netlify v1 usare Netlify Blobs.

Ogni record key deve contenere:

```ts
interface StoredAppKey {
  keyId: string;
  appId: string;
  label: string;
  keyHash: string;
  status: "active" | "revoked" | "rotating";
  createdAt: string;
  lastUsedAt?: string;
  allowedOrigins: string[];
  limits: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
  enabledCapabilities: Array<"chat" | "complete" | "vision" | "embeddings" | "models">;
}
```

La key in chiaro non deve essere salvata.

Per rate limit precisi e concorrenza reale, predisporre interfaccia `RateLimitStore` e implementare:
- `MemoryRateLimitStore` solo per test/dev;
- `UpstashRateLimitStore` consigliato per produzione;
- eventuale fallback permissivo ma con warning.

---

## 10. API Gateway Minime

### `GET /api/health`

Pubblica, senza auth.

Response:

```json
{
  "ok": true,
  "service": "ai-gateway",
  "version": "0.1.0"
}
```

### `GET /api/providers`

Protetta da app API key.

Restituisce provider e modelli disponibili, senza rivelare secret.

Response:

```json
{
  "providers": [
    {
      "id": "google",
      "label": "Google Gemini",
      "available": true
    },
    {
      "id": "groq",
      "label": "Groq",
      "available": true
    }
  ],
  "models": [
    {
      "id": "gemini-2-5-flash",
      "provider": "google",
      "model": "gemini-2.5-flash",
      "capabilities": ["chat", "streaming"]
    }
  ]
}
```

---

## 11. API Wrapper Provider Generica

### `POST /api/chat`

API principale per chat multi-turn.

Request:

```json
{
  "model": "auto:fast",
  "messages": [
    {
      "role": "system",
      "content": "You are helpful."
    },
    {
      "role": "user",
      "content": "Ciao, riassumi questo testo."
    }
  ],
  "stream": true,
  "temperature": 0.4,
  "maxOutputTokens": 512
}
```

Response streaming SSE quando `stream: true` e il provider supporta streaming:

```txt
event: meta
data: {"provider":"groq","model":"llama-3.3-70b-versatile"}

event: delta
data: {"text":"Ciao"}

event: delta
data: {"text":"!"}

event: done
data: {}
```

Fallback JSON quando streaming non disponibile o `stream: false`:

```json
{
  "provider": "google",
  "model": "gemini-2.5-flash",
  "text": "Risposta completa..."
}
```

### `POST /api/complete`

Wrapper single-turn semplice.

Request:

```json
{
  "model": "auto:balanced",
  "input": "Scrivi una breve descrizione del progetto.",
  "system": "Rispondi in italiano.",
  "stream": true
}
```

---

## 12. API Wrapper Per Modello Specifico

Il progetto deve prevedere un template per creare endpoint dedicati a un modello indicato.

Esempio template:

```txt
POST /api/model/<modelAlias>
```

Esempi futuri:

```txt
POST /api/model/gpt-4o-mini
POST /api/model/gemini-flash
POST /api/model/groq-llama-70b
POST /api/model/deepseek-r1
```

Per ora implementare un template generico che legge `modelAlias` da path o payload e lo risolve nel registry.

Request:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Spiegami questo codice."
    }
  ],
  "stream": true
}
```

Il registry deve contenere alias configurabili:

```ts
export const MODEL_REGISTRY = {
  "gemini-flash": {
    provider: "google",
    model: "gemini-2.0-flash",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512
  },
  "groq-llama-70b": {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512
  },
  "template-model": {
    provider: "template",
    model: "provider/model-name",
    capabilities: ["chat"],
    defaultMaxOutputTokens: 512
  }
} as const;
```

---

## 13. API Con Immagini Input

### `POST /api/vision`

Supporta modelli multimodali.

Request con URL immagine:

```json
{
  "model": "auto:vision",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Descrivi questa immagine."
        },
        {
          "type": "image_url",
          "imageUrl": "https://example.com/image.png"
        }
      ]
    }
  ],
  "stream": true
}
```

Request con base64/data URL:

```json
{
  "model": "auto:vision",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Cosa vedi?"
        },
        {
          "type": "image_data",
          "mimeType": "image/png",
          "data": "base64..."
        }
      ]
    }
  ]
}
```

Regole:
- validare MIME type;
- limitare dimensione immagine;
- accettare solo `image/png`, `image/jpeg`, `image/webp`;
- non loggare il contenuto base64;
- se possibile preferire URL firmati o immagini gia pubbliche;
- usare streaming se il provider/modello multimodale lo supporta.

---

## 14. API Embeddings

### `POST /api/embeddings`

Request:

```json
{
  "model": "auto:embedding",
  "input": [
    "Primo testo",
    "Secondo testo"
  ]
}
```

Response:

```json
{
  "provider": "google",
  "model": "gemini-embedding-001",
  "data": [
    {
      "index": 0,
      "embedding": [0.0123, -0.0456]
    }
  ]
}
```

Per ora implementare come template, pronto per provider esterni.

---

## 15. Provider Adapter Interface

Ogni provider deve implementare la stessa interfaccia.

```ts
export type GatewayChatRole = "system" | "user" | "assistant";

export type GatewayMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; imageUrl: string }
      | { type: "image_data"; mimeType: string; data: string }
    >;

export interface GatewayChatMessage {
  role: GatewayChatRole;
  content: GatewayMessageContent;
}

export interface ProviderChatRequest {
  model: string;
  messages: GatewayChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface ProviderChatResponse {
  provider: string;
  model: string;
  text: string;
}

export interface ProviderAdapter {
  id: string;
  label: string;

  isAvailable(): boolean;

  supports(model: string, capability: "chat" | "streaming" | "vision" | "embeddings"): boolean;

  chat(request: ProviderChatRequest): Promise<ProviderChatResponse>;

  streamChat?(request: ProviderChatRequest): AsyncGenerator<string>;

  embeddings?(request: {
    model: string;
    input: string[];
    signal?: AbortSignal;
  }): Promise<number[][]>;
}
```

---

## 16. Streaming SSE

Prendere ispirazione dal progetto `most-badass-resume-ever`, dove:
- la Function apre lo stream provider;
- invia un evento `meta` con provider/modello usato;
- invia eventi `delta` per ogni chunk;
- invia `done` a completamento;
- invia `error` se il provider fallisce dopo aver gia iniziato lo streaming.

Formato standard:

```txt
event: meta
data: {"provider":"google","model":"gemini-2.5-flash"}

event: delta
data: {"text":"..."}

event: done
data: {}
```

Errore mid-stream:

```txt
event: error
data: {"code":"UPSTREAM_ERROR","message":"Stream interrupted"}
```

Indicazioni implementative:
- il gateway deve iniziare a rispondere appena arriva il primo token;
- se un provider fallisce prima del primo token, provare fallback se configurato;
- se fallisce dopo il primo token, mandare evento `error`;
- usare `AbortController` per timeout;
- prevedere `FIRST_TOKEN_TIMEOUT_MS`;
- prevedere `OVERALL_TIMEOUT_MS`;
- non loggare API key o payload sensibili.

---

## 17. Routing Modelli

Prevedere alias astratti:

```txt
auto:fast
auto:balanced
auto:quality
auto:reasoning
auto:vision
auto:embedding
```

Template iniziale:

```ts
export const ROUTES = {
  "auto:fast": [
    "groq-llama-70b",
    "gemini-flash",
    "gemini-flash"
  ],
  "auto:balanced": [
    "gemini-flash",
    "gemini-flash",
    "groq-llama-70b"
  ],
  "auto:quality": [
    "gemini-flash",
    "gemini-flash"
  ],
  "auto:reasoning": [
    "gemini-flash"
  ],
  "auto:vision": [
    "gemini-flash"
  ],
  "auto:embedding": [
    "gemini-embedding"
  ]
} as const;
```

Per ora usare template e commenti: i modelli esatti saranno indicati successivamente.

---

## 18. Google Gemini Adapter

Usare `GOOGLE_API_KEY`.

Deve supportare:
- chat testuale;
- streaming se disponibile;
- input immagine per modelli compatibili;
- mapping dal formato gateway al formato Gemini.

Template modello:

```ts
{
  provider: "google",
  model: "gemini-2.0-flash",
  capabilities: ["chat", "streaming", "vision"]
}
```

---

## 20. Groq Adapter

Usare `GROQ_API_KEY`.

Deve supportare:
- chat testuale;
- streaming;
- modelli veloci per `auto:fast`.

Template modello:

```ts
{
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  capabilities: ["chat", "streaming"]
}
```

---

## 21. CORS

Le API devono supportare chiamate browser cross-origin.

Regole:
- ogni app key puo avere `allowedOrigins`;
- se `Origin` e presente, validarlo contro la lista della key;
- rispondere a `OPTIONS`;
- usare `Access-Control-Max-Age` per ridurre preflight.

Headers consigliati:

```http
Access-Control-Allow-Origin: <origin validato>
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-AI-Gateway-Key
Access-Control-Max-Age: 86400
```

---

## 22. Error Format

Formato errori JSON:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key"
  }
}
```

Codici minimi:
- `UNAUTHORIZED`
- `FORBIDDEN_ORIGIN`
- `INVALID_REQUEST`
- `MODEL_NOT_FOUND`
- `CAPABILITY_NOT_SUPPORTED`
- `PROVIDER_UNAVAILABLE`
- `RATE_LIMITED`
- `UPSTREAM_ERROR`
- `TIMEOUT`
- `INTERNAL_ERROR`

Non includere mai:
- API key;
- token provider;
- stack trace completo;
- payload immagini base64.

---

## 23. Client TypeScript Esportabile

Il progetto deve esportare un client in `src/client`.

Uso previsto negli altri progetti:

```ts
import { createAiGatewayClient } from "@personal/ai-gateway-client";

const ai = createAiGatewayClient({
  baseUrl: "https://ai-gateway-dq.netlify.app/api",
  apiKey: import.meta.env.VITE_AI_GATEWAY_KEY
});

const reply = await ai.complete({
  model: "auto:fast",
  input: "Riassumi questo testo",
  stream: false
});
```

Streaming:

```ts
await ai.chatStream(
  {
    model: "auto:fast",
    messages: [{ role: "user", content: "Ciao" }]
  },
  {
    onMeta: (meta) => console.log(meta),
    onDelta: (text) => console.log(text),
    onDone: () => console.log("done"),
    onError: (error) => console.error(error)
  }
);
```

Vision:

```ts
const result = await ai.vision({
  model: "auto:vision",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Descrivi questa immagine" },
        { type: "image_url", imageUrl: "https://example.com/image.png" }
      ]
    }
  ]
});
```

Il client deve includere:
- tipi request/response;
- parser SSE;
- gestione errori;
- supporto `AbortSignal`;
- build ESM;
- export da package.json.

---

## 24. OpenAPI / Contract

Aggiungere `docs/openapi.yml` o generarlo in una fase successiva.

Deve documentare:
- auth;
- endpoint;
- request/response;
- SSE events;
- error codes;
- image input schema;
- key management API.

---

## 25. Logging

Loggare solo metadati:

```ts
{
  requestId,
  appId,
  endpoint,
  provider,
  model,
  streaming,
  durationMs,
  status,
  errorCode
}
```

Non loggare:
- prompt completo;
- immagini base64;
- API key;
- provider secrets.

Prevedere `requestId` per correlare errori.

---

## 26. Rate Limit

Per v1:
- validare struttura e interfaccia;
- implementare rate limit in memoria per dev/test;
- predisporre Upstash per produzione.

Rate limit per app:
- requests per minute;
- requests per day;
- opzionalmente per capability;
- opzionalmente per modello pesante.

Quando superato:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded"
  }
}
```

---

## 27. Test Minimi

Implementare test per:
- auth valida/non valida;
- admin key valida/non valida;
- creazione key con hash e senza storage del plaintext;
- revoca key;
- CORS origin consentito/non consentito;
- validazione payload chat;
- validazione payload vision;
- provider fallback prima del primo token;
- SSE event format;
- errore mid-stream;
- client TypeScript parsing SSE.

Comandi richiesti:

```bash
npm run test
npm run lint
npm run build
```

---

## 28. README Richiesto

Il README.md deve includere:

- scopo del gateway;
- setup locale;
- env vars;
- deploy Netlify;
- come creare una API key app;
- come usare il client TypeScript;
- esempi `curl`;
- note sicurezza;
- limiti noti;
- come aggiungere un nuovo provider;
- come aggiungere un nuovo modello nel registry.

Esempio comando locale:

```bash
npm install
npx --yes netlify@26.1.0 dev --offline
```

---

## 29. .env.example

```txt
# Admin
AI_GATEWAY_ADMIN_KEY=change-me
AI_GATEWAY_KEY_PEPPER=change-me-long-random-string

# Providers
GOOGLE_API_KEY=
GROQ_API_KEY=
OPENAI_API_KEY=

# Optional production rate limit
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 30. Acceptance Criteria

Il progetto e completo quando:

- si deploya su Netlify;
- `/api/health` risponde senza auth;
- tutte le altre API richiedono API key;
- esiste endpoint admin per creare/listare/revocare API key app;
- le API key app sono salvate solo come hash;
- esistono endpoint `chat`, `complete`, `vision`, `embeddings`, `providers`, `model`;
- lo streaming SSE funziona per almeno un provider template o mock;
- provider registry e model registry sono configurabili;
- Gemini e Groq hanno adapter o template adapter pronti;
- il client TypeScript esportabile consuma almeno `complete`, `chatStream` e `vision`;
- test, lint e build passano;
- documentazione e .env.example sono presenti.

---

## 31. Fase 1 Consigliata

Implementare in questo ordine:

1. scaffold TypeScript + Netlify;
2. error handling, CORS, auth;
3. key management API;
4. provider/model registry;
5. mock provider con streaming SSE;
6. Gemini/Groq adapter template;
8. endpoint `chat` e `complete`;
9. endpoint `vision` template;
10. endpoint `embeddings` template;
11. client TypeScript;
12. test;
13. README e OpenAPI.

---

## 32. Non Obiettivi Per La V1

Non implementare subito:
- dashboard grafica;
- billing;
- multi-tenant pubblico;
- WebSocket;
- fine-tuning;
- observability avanzata;
- storage vettoriale;
- RAG completo;
- prompt management complesso.

La v1 deve essere piccola, chiara, deployabile e facile da usare dagli altri progetti personali.
