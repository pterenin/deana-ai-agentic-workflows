# Deana AI — Streaming Agentic Workflow

An agentic backend that powers a smart assistant for calendar, calls, and general tasks, streaming progress updates via Server-Sent Events. The agent can browse the web when needed, place phone calls, manage calendars across multiple accounts, and handle rescheduling/conflicts — all with safe defaults and security hardening.

## ✨ What this app does

- Natural-language assistant with real-time streaming updates (SSE)
- Multi-account Google Calendar reading and event creation
- Conflict detection and rescheduling workflow with options
- Outbound phone calls (via Vapi) for booking or general calls
- Generic web browsing (search + fetch) for live information
- Robust error handling and graceful fallbacks when browsing fails
- Security middleware (Helmet, CORS allowlist, rate limits, validation)

## 🧱 Architecture Overview

- `src/streaming-agents-server.ts` — single server entry (Express + SSE)
  - Security: Helmet, CORS allowlist, global/per-endpoint rate limits
  - Zod validates request payloads for `/api/chat` and `/api/chat/stream`
  - Streams agent progress and final responses
- Agent core
  - `src/agents/mainAgent.ts` — orchestrates LLM calls, tools, and tool results loop
  - `src/agents/tools/*` — tool schemas the LLM can call (calendar, email, calls, web)
  - `src/agents/handlers/*` — implementations of those tools
  - `src/agents/types.ts` — session types (accounts, user profile)
- Activities/utilities
  - `src/activities/calendar.ts` — Google Calendar operations
  - `src/agents/tools/generalCallTool.ts` — Vapi outbound calls (env-based creds)
  - `src/agents/handlers/webBrowseHandlers.ts` — search + fetch (Tavily + fetch) with SSRF/size/time guards

## 🧭 Agent Workflows (what it can do)

- Calendar
  - Read events across one or both accounts intelligently (today, week, custom ranges)
  - Create events (with attendees), delete events, update/reschedule
  - Detect conflicts and propose alternatives; complete rescheduling when user selects
- Booking flow (via call + calendar)
  - Understand booking intent, place phone call via Vapi, extract confirmed time, create calendar event
  - If time differs from request, clearly notify the user
- General outbound calls
  - “Call X and say Y” — uses validated phone number from message; otherwise uses session phone
  - Announces calling “on behalf of {userName}” if provided
- Web browsing (generic, any topic)
  - Search via `webSearch` (Tavily) and fetch via `webGet` with protocol/redirect/size/time caps
  - If browsing fails, answer from knowledge without hard-failing

## 🔐 Security Highlights

- Helmet security headers, CORS allowlist (via `ALLOWED_ORIGINS`), body size limits
- Global and per-endpoint rate limits (chat vs. stream)
- Zod validation for POST bodies (message, accounts, etc.)
- Browsing hardening: http/https only, 3 redirects, 10s timeout, 1MB cap, sanitized text, marked `untrusted`
- Vapi and other secrets only via environment variables; never logged, tokens redacted

## ⚙️ Requirements

- Node.js 18+
- Environment variables:
  - `OPENAI_API_KEY`
  - `ALLOWED_ORIGINS` (default `http://localhost:3000`)
  - `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `VAPI_ASSISTANT_ID` (and optionally `VAPI_ASSISTANT_ID_GENERAL`)
  - `TAVILY_API_KEY` (for `webSearch`)

## 🚀 Start & Build

```bash
npm install
npm run build
npm run streaming-agents-server
# Server: http://localhost:3060
```

Health:

- `GET /health` → `{ status: 'ok', timestamp }`

## 📡 API: POST /api/chat/stream (SSE)

Streaming endpoint that emits JSON lines as `data: { ... }`.

Body (JSON):

- `message` (string, required): user’s message
- `sessionId` (string, optional; default `default`)
- `email` (string, optional): user’s email
- `name` (string, optional): user’s name (used in calls)
- `phone` (string, optional): user phone (E.164 preferred)
- `timezone` (string, optional): IANA tz
- `clientNowISO` (string, optional): client timestamp
- `primary_account` (required):
  - `email` (string), `title` (string), `creds`:
    - `access_token` (string)
    - `refresh_token` (string)
    - `expires_at` (string)
    - `client_id` (string)
- `secondary_account` (optional, or null): same shape as primary

Events sent:

- `{ type: 'thinking' | 'progress' | 'response' | 'complete' | 'error', ... }`

Example request:

```bash
curl -X POST http://localhost:3060/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How does my day look?",
    "sessionId": "user-123",
    "email": "user@example.com",
    "name": "Alex User",
    "phone": "+17785551234",
    "timezone": "America/Los_Angeles",
    "clientNowISO": "2025-08-08T16:00:00.000Z",
    "primary_account": {
      "email": "primary@example.com",
      "title": "Personal",
      "creds": {
        "access_token": "...",
        "refresh_token": "...",
        "expires_at": "...",
        "client_id": "..."
      }
    },
    "secondary_account": null
  }'
```

## 📡 API: POST /api/chat (JSON)

Non-streaming counterpart; same body shape as above (excluding phone/timezone/clientNowISO if not needed). Returns one JSON object with `message`/`response`.

## 🧪 Development Notes

- The agent adds a system USER PROFILE (name/email/phone/timezone) so it can answer questions like “What is my name?”
- The agent uses tools automatically. For browsing, it may call `webSearch` and `webGet`; if they fail, it still responds from model knowledge.
- Phone validation normalizes numbers and prefers phone numbers inside the user’s message over session defaults.

## 🔧 Troubleshooting

- 403 CORS blocked: ensure your frontend origin is in `ALLOWED_ORIGINS`.
- 415 Unsupported Media Type: send `Content-Type: application/json`.
- 400 Invalid request body: check required fields and object shapes per above.
- Browsing errors: set `TAVILY_API_KEY`, verify outbound internet allowed.

## 📄 License

MIT (c) 2025 — You are free to use and modify with attribution.
