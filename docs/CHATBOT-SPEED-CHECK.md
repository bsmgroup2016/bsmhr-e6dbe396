# Chatbot connection and latency check — 25 November 2026

## Rule

A slow chatbot connection must not block a faster working connection. Live answers must still use the caller's authorized data; saved provider settings, OCR and historical messages must remain unchanged.

## Real provider tests

All four configured chatbot providers returned HTTP 200 and OK on a tiny real request:

| Provider | Initial elapsed time |
| --- | --- |
| Gemini #1 | 15.3 seconds |
| Gemini #2 | 14.3 seconds |
| Groq | 0.4 seconds |
| OpenRouter | 1.0 seconds |

The original sequential chain waited for Gemini despite much faster working alternatives. After the changes, shared selection returned Groq in 2.4 seconds; the real assistant engine returned OK in 2.8 seconds, including loading its configured training context. These are measurements, not guaranteed response times for longer questions.

## Places checked in source

| Place | Finding / outcome |
| --- | --- |
| All-page LiveChatWidget, its request helper and AppShell mount | Sends once, reads saved replies and polls at four-second intervals. No browser provider key or new retry of message writes. Unchanged. |
| `/api/public/live-chat` AI reply branch | Calls shared runAssistant, so receives faster selection and parallel read-only tools. Existing message persistence, history and permissions unchanged. |
| `/api/public/assistant` and runAssistant | Sequential provider waits and serial independent tool reads were the latency defects. Uses cancellable staggered selection now; later rounds prefer the winner and retain conversation/tool results instead of restarting lookups. |
| Chatbot Training page and TrainingPanel | Uses protected training endpoint. UI unchanged. |
| `/api/public/ai-training`: manual skills, crawl with skills, hourly cron | All call the training chat helper. Replaced its separate unbounded sequential network chain with the shared selector and a 60-second generation deadline. No cron configuration changes or crawl writes performed during verification. |
| Settings API Integration tests and `/api/public/api-integrations` | Individual providers remain individually testable; tests now require real nonempty completion text, have a 20-second deadline and return elapsed time plus actual response model. No keys/order/enabled flags were edited. |
| postChat / activeProviders | Shared transport supports cancellation. Configured categories and enabled-only ordering remain intact; Gemini 503 model fallback remains. |
| OCR askAiJson | Separate providers and 120-second document timeout already exist. Does not use the chatbot selector; unchanged. |
| AI Brain test and request contract | Separate explicitly selected service, not the configured chatbot chain. Unchanged; 14 regression tests pass. |
| Existing database functions | No chatbot inference RPC exists on these traced paths: reads/writes use REST and AI generation runs in the server helpers. No database function, schema, permissions or settled records changed. |

## Verification and limits

- Six new regression tests verify preferred-provider head start, slow-provider bypass, cancellation, timeout, preservation of tool context, empty/error rejection and full-body parsing before selection.
- All 20 focused tests passed; latest preview build OK.
- Browser `/assistant` redirects to `/auth`; signed-out assistant, live-chat and integration test requests return 401. Training validates its body first (invalid body returns 400); its existing authenticated/admin/cron checks remain unchanged.
- A real signed-in end-to-end message → saved reply → reload was **not** verified: this external-auth project cannot mint an authorized sandbox session. No credentials were requested and no authentication was bypassed.
- Provider tests and real engine connectivity checks used only “OK” requests, not employee data. No live chat history, training notes, records or configuration was modified.
- Staggering may briefly start multiple configured provider requests; losing requests are cancelled when a complete valid answer arrives. Provider accounting may still count started requests.