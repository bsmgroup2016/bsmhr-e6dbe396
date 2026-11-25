# AI Brain service

AI Brain has optional integrations for document review and chat; software calculations remain separate. Its initial transport setup did not send HR records to the provider.

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
- OCR, time-card/document reading and provider tests (`ai.server.ts`, `ocr.server.ts`, `api-integrations.server.ts`): standalone native fetch.
- Assistant endpoint: delegates to the existing assistant service; shared provider forwarding is standalone fetch.
- Email delivery and nightly automation (`email.server.ts`, `automation-run.server.ts`): standalone fetch/shared email sender.
- Storage uploads (v1 and legacy), Media browsing/upload/delete, R2 status/deletion, signed file reads and archive storage: object methods belong to `AwsClient`, where method binding is intentional; these are not native global fetch references.
- Application server entry: `handler.fetch()` is the framework server-entry method, not a native network fetch reference.
- Searched database migrations and Supabase sources for AI Brain/completions and HTTP cron calls: no direct AI Brain/database forwarding implementation found.

These sibling paths were inspected for this invocation bug, not end-to-end retested. No permissions, provider settings, existing records or sample data were changed. The real signed-in Settings click remains unverified without an authorized app session.

## Optional OCR reader (25 November 2026)

- Added a separate OCR provider row, model `hr-brain`, URL `https://stbd.seobdshop.com/v1/chat/completions`, using server-only `HR_BRAIN_API_KEY`. Gemini and OpenAI settings are unchanged; Claude has subsequently been removed by the owner. Migration `db/migrations/0077_ai_brain_ocr.sql` inserts the AI Brain row idempotently and never restores deleted/changed settings on page load.
- Enabled AI Brain for the requested OCR trial. Its existing row controls support on/off, ordering, details, editing, testing and deletion. Provider testing now displays returned model and elapsed time in Details.
- The shared OCR service forwards image content and PDF file parts, explicitly sends `stream: false` (required by this upstream) and omits provider-specific `reasoning_effort`. Document extraction and the time-card fallback use this service; claim templates, calculated hours and approval behavior remain unchanged.
- Live shared-service checks on a fictional printed fixture returned the correct name, P-File, date and check-in/out for both PNG (~7.6s) and PDF (~5.4s). This verifies the transport and readable printed content, not handwritten-card accuracy. No real worker file was sent or stored by the check.
- 35 focused OCR, AI Brain and time-card tests passed. Signed-in Settings and an actual uploaded time-card batch remain unverified: this external account service cannot mint a sandbox session.

## Removed OCR reader

Claude's reader, Settings test adapter and SDK dependency are removed. Shared provider resolution rejects old Claude/Anthropic OCR rows by endpoint, label or model before reading a key. Time-card Gemini/OpenAI disagreements remain flagged instead of invoking Claude; AI Brain fallback and other providers' saved toggles remain unchanged. No integration is recreated and no worker files or claim templates are modified.

Source coverage: employee IPA registration/onboarding (`employee-registration.tsx`), employee IPA/passport/work-permit/Particular/CSOC autofill (`employee-form.tsx`), document-register passport reads (`documents.tsx`), medical-bill reads (`medical-claims-panel.tsx`), spreadsheet column mapping (`data-io.tsx`), time-card upload/retry (`claim-demo/pipeline.ts`), shared browser service (`ocr.ts`), OCR dispatch/status routes, Settings provider loading/testing and the shared server resolver were read. All use the same server resolver; none has an independent Claude call. The AI Brain migration only inserts AI Brain and does not restore Claude. Searches found no separate OCR background job or database function invoking Claude. Existing records, permissions and provider toggles were not changed. Signed-in Settings and real uploaded-file flows remain unverified because an authorized external-account session is unavailable.