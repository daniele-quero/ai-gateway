# Piano: integrare il client `ai-gateway` in un progetto consumer via dipendenza `file:`

Questo documento è pensato per essere copiato/esportato in un altro progetto (es. KTC) e
seguito passo passo per collegarlo al gateway usando l'**Opzione 1** (dipendenza locale
`file:`), adatta quando gateway e consumer vivono sullo stesso filesystem/macchina.

Riferimento architetturale: [PLAN.md](../PLAN.md) del progetto `ai-gateway`.

---

## 0. Prerequisiti

- [ ] Il repo `ai-gateway` esiste in locale, ad es. `C:\Users\dquero\projects\ai-gateway`.
- [ ] Il repo `ai-gateway` è stato buildato almeno una volta (`npm run build:client` genera `dist/client`).
- [ ] Il gateway è deployato su Netlify (o gira in locale con `netlify dev`) e conosci il suo `baseUrl`, es.:
  - prod: `https://<tuo-sito>.netlify.app/api`
  - locale: `http://localhost:8888/api`
- [ ] Esiste già una app API key generata per questo consumer (vedi sezione 4) oppure la creerai in questo step.
- [ ] Node.js 20+ anche nel progetto consumer.

---

## 1. Determinare il percorso relativo tra i due progetti

Se la struttura cartelle è, ad esempio:

```txt
projects/
  ai-gateway/
  ktc/            <- progetto consumer
```

Il path relativo da `ktc/` verso `ai-gateway/` è `../ai-gateway`.

Se i progetti non sono nella stessa cartella padre, calcola il path relativo corretto oppure
usa un path assoluto (meno portabile, valido solo in locale).

---

## 2. Aggiungere la dipendenza nel progetto consumer

Nel progetto consumer:

```powershell
npm install file:../ai-gateway
```

Effetti:
- npm crea un symlink (o copia, a seconda del package manager) verso `ai-gateway` in `node_modules/@personal/ai-gateway`.
- Viene eseguito automaticamente lo script `prepare` del gateway (`npm run build:client`), quindi `dist/client` viene rigenerato se mancante.
- `package.json` del consumer avrà una riga tipo:

```json
"dependencies": {
  "@personal/ai-gateway": "file:../ai-gateway"
}
```

### Nota su aggiornamenti successivi

Con `file:` npm **non rileva automaticamente** le modifiche al codice sorgente del gateway.
Dopo ogni modifica a `src/client` nel repo gateway:

```powershell
# nel repo ai-gateway
npm run build:client
```

```powershell
# nel repo consumer, per essere sicuri che i node_modules siano aggiornati
npm install
```

(Su Windows con symlink funzionanti spesso basta il primo comando; se il consumer non vede le
modifiche, esegui anche il secondo.)

---

## 3. Importare ed inizializzare il client

Nel codice del consumer:

```ts
import { createAiGatewayClient } from "@personal/ai-gateway/client";

export const ai = createAiGatewayClient({
  baseUrl: process.env.AI_GATEWAY_BASE_URL ?? "https://<tuo-sito>.netlify.app/api",
  apiKey: process.env.KTC_API_KEY!,
});
```

Adatta la lettura delle env secondo lo stack del consumer:

- **Vite / frontend**: usa `import.meta.env.VITE_AI_GATEWAY_BASE_URL` e `import.meta.env.VITE_KTC_API_KEY`.
  Attenzione: se il consumer è un frontend puro, la key finisce comunque nel bundle client-side.
  Questo è coerente con l'architettura del gateway (vedi [PLAN.md](../PLAN.md) sezione 3), ma
  richiede che la key abbia `allowedOrigins` e `limits` stretti (vedi sezione 4).
- **Node/Next.js backend**: usa `process.env.KTC_API_KEY` da variabili server-side, mai esposte al bundle client.

---

## 4. Creare la app API key per questo consumer (se non esiste già)

Chiamata da eseguire una sola volta contro il gateway deployato, con l'admin key:

```powershell
curl -X POST https://<tuo-sito>.netlify.app/api/keys `
  -H "Authorization: Bearer $env:AI_GATEWAY_ADMIN_KEY" `
  -H "Content-Type: application/json" `
  -d '{
    "appId": "ktc",
    "label": "KTC consumer",
    "allowedOrigins": ["http://localhost:5173", "https://ktc.example.tld"],
    "limits": { "requestsPerMinute": 10, "requestsPerDay": 500 },
    "enabledCapabilities": ["chat", "complete"]
  }'
```

Salva il valore `apiKey` restituito (mostrato **una sola volta**) come `KTC_API_KEY` nelle
variabili d'ambiente del consumer (`.env` locale + secret del provider di hosting).

Aggiorna `allowedOrigins` e `enabledCapabilities` in base alle esigenze reali di KTC (vedi
la spiegazione delle capability già discussa in chat).

---

## 5. Esempio d'uso end-to-end

```ts
import { createAiGatewayClient } from "@personal/ai-gateway/client";

const ai = createAiGatewayClient({
  baseUrl: process.env.AI_GATEWAY_BASE_URL!,
  apiKey: process.env.KTC_API_KEY!,
});

// Non-streaming
const reply = await ai.complete({
  model: "auto:fast",
  input: "Riassumi questo testo per KTC",
});
console.log(reply.text);

// Streaming
await ai.chatStream(
  { model: "auto:fast", messages: [{ role: "user", content: "Ciao" }] },
  {
    onMeta: (meta) => console.log("provider/model:", meta),
    onDelta: (text) => process.stdout.write(text),
    onDone: () => console.log("\n[done]"),
    onError: (err) => console.error("stream error:", err),
  },
);
```

---

## 6. Checklist finale

- [ ] `npm install file:../ai-gateway` eseguito nel progetto consumer senza errori.
- [ ] `dist/client` presente nel repo gateway (verificabile con `Test-Path ..\ai-gateway\dist\client`).
- [ ] Variabili d'ambiente del consumer configurate: `AI_GATEWAY_BASE_URL` (o equivalente `VITE_*`) e `KTC_API_KEY`.
- [ ] Key creata via `POST /api/keys` con `allowedOrigins` e `enabledCapabilities` corretti per KTC.
- [ ] Test manuale: una chiamata `ai.complete(...)` o `ai.chatStream(...)` va a buon fine dal consumer.
- [ ] `.env` del consumer non versionato (verifica `.gitignore`).

---

## 7. Quando passare a un'altra opzione

L'opzione `file:` è indicata solo per sviluppo locale sullo stesso filesystem. Se in futuro:

- il consumer viene deployato su un servizio esterno (Netlify/Vercel/altro) → passare a
  dipendenza Git (`github:<utente>/ai-gateway`), che esegue automaticamente `prepare` al
  momento dell'installazione remota;
- serve congelare una versione specifica senza dipendere da path o git → usare `npm pack`
  e installare il tarball generato.

Entrambe le alternative sono già supportate dal gateway grazie allo script `prepare` in
[package.json](../package.json).
