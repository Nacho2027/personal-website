# External Integrations

**Analysis Date:** 2026-04-17

## APIs & External Services

**AI/LLM:**
- Anthropic Claude API - Powers PROMETHEUS chatbot conversation
  - SDK/Client: `@anthropic-ai/sdk` v0.52.0
  - Model: claude-haiku-4-5-20251001
  - Auth: `process.env.ANTHROPIC_API_KEY`
  - Implementation file: `api/chat.ts`
  - Features: Streaming responses, conversation history support, max 1024 tokens per response

## Data Storage

**Databases:**
- None (static content only)

**File Storage:**
- Local filesystem with static file serving
  - Audio assets: `assets/audio/` (5 keyboard samples, delete, ambient background)
  - Image assets: `assets/images/` (favicon, apple-touch-icon)
  - Build output: `dist/` (bundled JavaScript)

**Caching:**
- Vercel KV (Redis-compatible distributed cache)
  - Purpose: Rate limiting
  - Service: `@vercel/kv`
  - Implementation: `api/chat.ts` - `checkRateLimit()` function
  - Key pattern: `ratelimit:{client-ip}`
  - Limits: 50 messages per 24-hour window per IP
  - Expiry: 86400 seconds (24 hours) per request window

## Authentication & Identity

**Auth Provider:**
- Custom implementation (no external provider)
- Approach: IP-based rate limiting only
  - Client IP extracted from Vercel headers (`X-Forwarded-For`, `X-Real-IP`)
  - No user authentication required
  - Rate limits are per IP address

## Monitoring & Observability

**Error Tracking:**
- Not configured (errors logged to console only)

**Logs:**
- Browser console: Frontend errors and debug output
- Vercel function logs: Backend error logging via `console.error()` and `console.warn()`
- Specific logging in `api/chat.ts`:
  - Rate limit failures
  - Claude API errors (with status codes)
  - Anthropic-specific error handling (429, 400, 401/403 status codes)

## CI/CD & Deployment

**Hosting:**
- Vercel Platform
  - Configuration: `vercel.json`
  - Build process: `npm run build` (runs tsup bundler)
  - Static hosting for HTML, images, audio, built JavaScript
  - Serverless functions support for `/api/*` routes

**CI Pipeline:**
- Not configured (local build only)
- Manual deployment to Vercel via git push or Vercel CLI

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Anthropic API credentials (production)
- `SYSTEM_PROMPT` - PROMETHEUS AI personality and knowledge base (or fallback to `api/system-prompt.ts` in development)

**Optional env vars:**
- None currently

**Secrets location:**
- `.env` file (gitignored, exists locally)
- Vercel environment variables (for production)
- `api/system-prompt.ts` (gitignored local fallback for development)

**Notes on secrets:**
- `SYSTEM_PROMPT` is a complex string containing Ignacio's professional info, AI instructions, and personality configuration
- In production, environment variables are set via Vercel dashboard
- Local development reads from `.env` or `api/system-prompt.ts`
- The system prompt is never exposed to clients (server-side only)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- `POST /api/chat` - Client-side to backend
  - Request body: `{ message: string, history: Array<{role, content}> }`
  - Response: Streaming text (text/plain; charset=utf-8)
  - Rate limit headers: `X-RateLimit-Remaining`
  - Error responses: JSON with `error` field

## Response Handling

**API Endpoint: `/api/chat`**
- Location: `api/chat.ts`
- Method: POST
- Input:
  - `message` (string) - User message required
  - `history` (array) - Conversation history optional
- Output:
  - Streaming text response from Claude
  - Transfer-Encoding: chunked
  - Content-Type: text/plain; charset=utf-8
- Error handling:
  - `400` - Missing/invalid message parameter
  - `401/403` - API key issues (returned as 402 quota_exceeded)
  - `402` - Quota/billing exceeded
  - `429` - Rate limited (checked server-side via Vercel KV)
  - `500` - Server error

**Rate Limiting:**
- Implementation: `checkRateLimit()` in `api/chat.ts`
- Per-IP limit: 50 messages per 24-hour window
- Storage: Vercel KV
- Client notification: `X-RateLimit-Remaining` header in response
- Graceful fallback: If KV service fails, requests are allowed (logged)

## Client-Side API Calls

**Location:** `src/terminal/ShellEmulator.ts`
- Function: `sendToPrometheus()`
- Endpoint: `/api/chat`
- Implementation: Streaming text processing with typewriter effect
- Conversation history: Maintained client-side in memory
- Error handling: Specific handling for 429 (rate limit), 500 (server error)

---

*Integration audit: 2026-04-17*
