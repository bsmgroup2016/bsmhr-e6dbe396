# AI Brain service

AI Brain is isolated from existing OCR, chatbot and HR calculations. No HR records are read, written or automatically sent to the provider.

## Backend and secrets

This app uses its existing edge-hosted TanStack server route **POST /api/public/hr-brain**, not a separately deployed Supabase Edge Function. The handler explicitly checks the user's Supabase session and admin role because `/api/public/` bypasses site authentication. Access is admin-only until a future HR integration adds feature-specific authorization.

Store `HR_BRAIN_API_KEY` in the encrypted project secret store; it is read only by the server. Optional `HR_BRAIN_BASE_URL` overrides the HTTPS default `https://stbd.seobdshop.com/v1`. These project secrets are not automatically copied into the external Supabase Edge Function secret store.

Requests always use model `hr-brain`, default `max_tokens: 2048`, and raise positive budgets below 1024 to 1024. Invalid nonpositive budgets are rejected. `systemPrompt` is prepended as a system message. Optional temperature and OpenAI function tools are forwarded; this transport does not execute tools.

The backend supports JSON completions and direct SSE passthrough, no caching, a two-minute request timeout and request cancellation. Cross-origin access is limited to the application's known domains; CORS never replaces authentication. Provider failures return HTTP 502 and `upstreamStatus`, with safe error descriptions rather than potentially credential-containing raw upstream bodies.

## Browser usage

```ts
import { callHrBrain } from '@/lib/hrBrain';

const completion = await callHrBrain({
  messages: [{ role: 'user', content: 'Say OK' }],
  stream: false,
});
console.log(completion.choices[0]?.message.content, completion.model);

const controller = new AbortController();
const response = await callHrBrain({
  messages: [{ role: 'user', content: 'Say OK' }],
  stream: true,
}, controller.signal);
// Consume response.body with your feature's SSE parser.
// controller.abort() cancels the request.
```

Settings → API Integration → Test AI Brain sends `Say OK` using the default 2048-token budget and displays the actual returned text and model. It does not change provider ordering or existing HR workflows.