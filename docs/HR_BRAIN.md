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

## Tool-calling check (25 November 2026)

Rule: the chatbot assistant only works with a provider that can call tools, because every factual answer comes from `query_table`, `count_rows`, `describe_table`, `workforce_alerts` and `get_worker_files`.

The real provider was called directly with the app's tool list and no HR data:

- `stream: false` sent explicitly returns a normal JSON completion. Omitting the field makes the upstream stream SSE chunks instead, so callers must always send `stream` explicitly.
- With `tools` and `tool_choice: "auto"`, the upstream returned a valid `count_rows` tool call with arguments `{"table":"employees"}` instead of guessing an answer.
- Feeding the tool result back produced the final answer. The number in that answer (37) was a fixture value supplied by the test, not a real worker count.
- The upstream reports its own model name (`gemini-4-hydrogen`) even though the app always sends model `hr-brain`.

Consequence: AI Brain is capable of driving the assistant's live data lookups, so it can sit in front of the existing chatbot chain rather than replace it. The route itself stays admin-only until feature-specific authorization is added, so a chatbot wiring must decide who may spend this service.

## Live chat toggle (25 November 2026)

The owner chose AI Brain as an optional extra, not the primary engine. The default provider chain (Gemini → Groq → OpenRouter, staggered/hedged) is unchanged and handles every message by default. Admins see a brain toggle in the live chat header; when it is on, that message is sent with `engine: "hr-brain"`, and the live-chat route honors it only for callers with the admin role. `runAssistant` then calls the AI Brain upstream directly (server-side, `HR_BRAIN_API_KEY` secret, `stream: false`) with the same tool list and tool loop, so live data lookups work identically. Non-admin callers and toggled-off messages never touch the paid endpoint.

## Runtime invocation check

Rule: a valid configured AI service must receive the app's request, not fail inside the server before reaching the provider.

The first AI Brain implementation invoked native Worker fetch as `deps.fetch()`. This bound `this` to the dependency object and caused `TypeError: Illegal invocation`. Reproduced in workerd with the real provider; detached invocation returned HTTP 200. Both JSON and SSE share the corrected forwarding call. A regression test rejects bound calls.

Code inspection of sibling paths found no other instance of this native-fetch binding bug:

- Settings test and typed browser helper: ordinary standalone fetch; both JSON and SSE call the same protected endpoint.
- OCR, time-card/document reading and provider tests (`ai.server.ts`, `ocr.server.ts`, `api-integrations.server.ts`): standalone native fetch; Claude reader/test uses the Anthropic SDK, not an injected native fetch method.
- Assistant endpoint: delegates to the existing assistant service; shared provider forwarding is standalone fetch.
- Email delivery and nightly automation (`email.server.ts`, `automation-run.server.ts`): standalone fetch/shared email sender.
- Storage uploads (v1 and legacy), Media browsing/upload/delete, R2 status/deletion, signed file reads and archive storage: object methods belong to `AwsClient`, where method binding is intentional; these are not native global fetch references.
- Application server entry: `handler.fetch()` is the framework server-entry method, not a native network fetch reference.
- Searched database migrations and Supabase sources for AI Brain/completions and HTTP cron calls: no direct AI Brain/database forwarding implementation found.

These sibling paths were inspected for this invocation bug, not end-to-end retested. No permissions, provider settings, existing records or sample data were changed. The real signed-in Settings click remains unverified without an authorized app session.