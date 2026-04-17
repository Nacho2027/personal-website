# Codebase Concerns

**Analysis Date:** 2026-04-17

## Security

### Critical: Committed Secrets in Repository

**Issue:** `.env` file is checked into git history despite being in `.gitignore`
- Files: `.env`
- Risk: **CRITICAL** - The `ANTHROPIC_API_KEY` (sk-ant-api03-...) is exposed in git history and accessible via repository access
- Impact: API key is compromised. Any user with repository access can abuse the Anthropic account
- Current mitigation: `.gitignore` entry prevents future commits, but doesn't remove history
- Recommendations:
  1. **Immediately revoke** the exposed Anthropic API key in account settings
  2. **Generate a new API key** and update production environment
  3. **Use `git filter-branch` or `bfg-repo-cleaner`** to remove `.env` from git history
  4. **Force push** only if this is a private repo (coordinate with team)
  5. Consider using git pre-commit hooks to prevent committing `.env` files
  6. For local development, create `.env.example` with placeholder values instead

**Detection:** Git log reveals `.env` tracked in commits; file contains real API keys with `sk-ant-` prefix

---

## Code Quality Issues

### Large Files Requiring Refactoring

**XTermAdapter (885 lines):**
- Files: `src/terminal/XTermAdapter.ts`
- Problem: Single class with too many responsibilities - terminal management, keyboard handling, clipboard operations, selection, game mode toggling, audio playback, cursor management
- Impact: Difficult to test, maintain, and extend. Changes to one concern risk breaking others
- Safe modification: Extract into smaller focused classes (e.g., `KeyboardHandler`, `ClipboardManager`, `SelectionManager`, `GameModeManager`)
- Test coverage: Limited - no unit tests found for interactive behavior

**ShellEmulator (685 lines):**
- Files: `src/terminal/ShellEmulator.ts`
- Problem: Combines command routing, command implementations (help, clear, vim, piano, theme, resume), PROMETHEUS integration, rate limiting, and history management
- Impact: Hard to test individual commands; vim easter egg is deeply embedded (~150 lines)
- Safe modification: Extract command implementations into separate modules, create `commands/` subdirectory
- Test coverage: No test files found for command logic

**Theme system (365 lines):**
- Files: `src/terminal/theme.ts`
- Problem: Manual theme definitions are verbose; theme selector is interactive and tightly coupled to terminal
- Impact: Adding themes requires repetitive code; hard to reuse theme logic
- Safe modification: Refactor themes into data structure, extract theme application logic

---

### Error Handling Gaps

**API Layer:**
- Files: `api/chat.ts`
- Issues:
  1. Line 70: Rate limit check gracefully falls back to `allowed: true` if KV fails - masks infrastructure issues
  2. Line 138: Console.error for Claude API errors - logs to server but no structured error reporting
  3. Lines 141-162: Broad error categorization (status 401/403 mapped to 402 "quota_exceeded") - conflates auth failures with billing
- Impact: Hard to debug production issues; rate limiting can be silently bypassed if KV is down
- Recommendation: Add structured logging/error tracking (Sentry, DataDog); distinguish between auth and quota errors

**Audio Module:**
- Files: `src/terminal/audio.ts`, `src/terminal/piano.ts`
- Issues:
  1. Line 66 (audio.ts): Catch-all console.warn when audio files fail to load - may silently fail with no user feedback
  2. Lines 73-114: Audio playback falls back to `return` silently if buffers aren't loaded - poor UX
  3. Line 93-96 (piano.ts): setTimeout for cleanup is a fire-and-forget pattern - no guarantee cleanup happens
- Impact: Audio may not work, users won't know why; potential for orphaned audio resources
- Recommendation: Provide visual feedback when audio fails; use proper async/await for resource cleanup

**Frontend Error Handling:**
- Files: `src/index.ts`
- Issues:
  1. Line 81: `runScene().catch(console.error)` - only logs to console, doesn't gracefully degrade
  2. No null checks on DOM queries beyond line 14
- Impact: Broken state if Three.js setup fails; no recovery mechanism
- Recommendation: Add fallback UI; emit events to enable recovery paths

---

### Console Logging in Production Code

**Locations:**
- `api/chat.ts` lines 70, 138 - console.error for API errors
- `src/terminal/audio.ts` line 66 - console.warn for loading failures
- `src/terminal/theme.ts` line 259 - console.warn for missing TerminalText reference
- `src/terminal/XTermAdapter.ts` lines 253, 615 - console.warn for clipboard operations

**Impact:** Development-only debug logs are exposed in production; can leak information to browser console; makes error tracking harder
**Recommendation:** Replace with structured logging library or error boundary pattern; remove console statements from production

---

### Linter Ignores Without Justification

**Locations:**
- `api/chat.ts` line 20: `@typescript-eslint/no-require-imports` - Required for dynamic system prompt loading, but comment explains it
- `src/terminal/XTermAdapter.ts` line 47: `biome-ignore lint/correctness/noUnusedPrivateClassMembers` - marked as "used via this.outputBuffer" but property `outputBuffer` is never accessed in code

**Impact:** Dead property `outputBuffer` takes up memory; may be artifact of refactoring
**Recommendation:** Remove unused `outputBuffer` property from XTermAdapter class

---

### Dependency Issues

**legacy-peer-deps=true:**
- Files: `.npmrc`
- Problem: Forces npm to ignore peer dependency conflicts instead of resolving them
- Impact: May hide version incompatibilities; could cause runtime issues
- Recommendation: Audit peer dependency warnings with `npm ls` and fix root cause instead of forcing legacy mode

**No Test Infrastructure:**
- Files: `package.json` line 10
- Problem: Test script returns error; no testing framework configured
- Impact: No automated testing; features relying on complex logic (vim, piano, shell commands) are untested
- Recommendation: Add Jest or Vitest; create test suite for command handlers and interactive components

**Anthropic SDK Version:**
- Files: `package.json` line 35
- Current: `@anthropic-ai/sdk` `^0.52.0`
- Recommendation: Pin major version or check regularly for breaking changes in SDK updates

---

## Test Coverage Gaps

### Untested Complex Features

**Vim Easter Egg:**
- Files: `src/terminal/ShellEmulator.ts` lines 202-399
- What's not tested: Mode transitions (normal→insert→command), line editing, file saving/loading, edge cases (empty lines, cursor boundaries), buffer persistence
- Risk: Changes to vim implementation could break the escape sequence or command parsing without detection
- Priority: **Medium** - breaks user experience when broken, but non-critical feature

**Interactive Piano:**
- Files: `src/terminal/piano.ts` lines 108-197
- What's not tested: Polyphonic playback, note cleanup, rapid key presses, edge case keys (semicolon, quote), escape handling
- Risk: Memory leaks from orphaned oscillators; missing cleanup could hang the audio context
- Priority: **Medium** - audio context exhaustion could freeze the site

**Shell Command Routing:**
- Files: `src/terminal/ShellEmulator.ts` lines 122-161
- What's not tested: Command parsing with quotes/escapes, unknown command routing to PROMETHEUS, error handling in command handlers
- Risk: Malformed input could crash command processing or cause unexpected PROMETHEUS responses
- Priority: **High** - core user interaction path

**PROMETHEUS AI Integration:**
- Files: `src/terminal/ShellEmulator.ts` lines 552-597 (sendToPrometheus)
- What's not tested: Rate limiting enforcement, streaming response handling, API failures, incomplete responses
- Risk: Rate limit bypass (see Security section); incomplete responses leave partial text on screen
- Priority: **High** - primary feature; rate limit is security-critical

**Terminal Rendering:**
- Files: `src/terminal/XTermAdapter.ts` (all of it)
- What's not tested: Window resize handling, clipboard operations, key event handling, selection behavior
- Risk: Display corruption, input loss, or selection bugs in edge cases
- Priority: **High** - core UX

---

## Performance Bottlenecks

### Audio Loading on First Keypress

**Problem:** Audio samples loaded asynchronously in `initAudio()` called from `XTermAdapter` constructor
- Files: `src/terminal/audio.ts` lines 31-68, `src/terminal/XTermAdapter.ts` line 82
- Cause: 5 MP3 files + 1 WAV + 1 MP3 for ambient music fetched and decoded on demand
- Impact: First keypress may have 100-500ms delay while audio loads; user experiences unresponsive keyboard
- Improvement path: Preload critical audio files (key clicks) in index.html with `<link rel=preload>`; load ambient/backspace sounds in background

### PROMETHEUS API Call Latency

**Problem:** Every user input triggers HTTP request to `/api/chat` with full conversation history
- Files: `api/chat.ts` lines 108-125, `src/terminal/ShellEmulator.ts` lines 552-597
- Cause: Streaming response from Claude API has baseline ~500ms-2s latency; history grows with each message
- Impact: User experience degrades as conversation grows; no perceived feedback until first token arrives
- Improvement path:
  1. Show "PROMETHEUS is thinking..." immediately after user input
  2. Implement conversation compression/summarization to keep history bounded
  3. Consider caching common responses

### Large Bundle Size

**Problem:** `dist/index.global.js` is 2.3MB uncompressed
- Files: `dist/index.global.js` (generated artifact)
- Cause: Three.js (~600KB), cool-retro-term-renderer (~300KB), xterm.js (~200KB), plus application code
- Impact: Initial load time; slow on 3G networks; mobile experience degraded
- Improvement path:
  1. Enable gzip compression on Vercel (should already be done)
  2. Consider lazy-loading Three.js only on desktop (mobile detection exists)
  3. Tree-shake unused Three.js features with webpack/tsup config

---

## Fragile Areas

### Clipboard Operations

**Problem:** Browser clipboard API has permission model; operations fail silently
- Files: `src/terminal/XTermAdapter.ts` lines 240-260 (paste), lines 600-620 (copy)
- Why fragile: Clipboard access denied on HTTP (requires HTTPS); fails gracefully but without user indication
- Safe modification: Wrap in try-catch with user-facing toast/message; check `navigator.clipboard` availability first
- Test coverage: No tests for clipboard paths; "Could not read/copy clipboard" warnings are only indication

### DOM Element Assumptions

**Problem:** XTermAdapter creates hidden container div; assumes document.body exists
- Files: `src/terminal/XTermAdapter.ts` lines 57-63
- Why fragile: Created immediately on class instantiation; no fallback if DOM isn't ready or body doesn't exist
- Safe modification: Delay container creation to first actual use; check `document.body` before append
- Test coverage: SSR would break this; no test for DOM readiness

### Theme System State Management

**Problem:** Global `terminalText` reference for theme application; initialized via setter
- Files: `src/terminal/theme.ts` lines 259, `src/index.ts` line 8, 33
- Why fragile: Theme system depends on side effect (`setTerminalTextRef`) being called before themes are accessed
- Safe modification: Use dependency injection or event emitter instead of global reference
- Test coverage: No tests for theme application; brittle initialization order

### Vim State Persistence

**Problem:** Vim buffer persists between sessions as module-level variable
- Files: `src/terminal/ShellEmulator.ts` lines 199-212
- Why fragile: Manual :wq saves buffer to module variable; no way to reset; could accumulate large amounts of text
- Safe modification: Store vim state in sessionStorage with size limit; provide way to clear
- Test coverage: No tests for save/restore behavior

---

## Missing Critical Features

### No Offline Capability

**Problem:** PROMETHEUS responses require API call; site is unusable without network
- Impact: Typing anything that isn't a built-in command (help, clear, vim, piano, theme, resume) returns error
- Blocks: Offline demonstration, demo mode for no-network environments
- Recommendation: Add fallback responses or demo mode that works without API

### No User Feedback for Long Operations

**Problem:** PROMETHEUS responses have 1-3s latency; no "typing" or "thinking" indicator
- Impact: User doesn't know if input was received; appears frozen
- Blocks: Good UX for slow networks
- Recommendation: Show "PROMETHEUS is thinking..." immediately; implement skeleton/loading state

### No Session Persistence

**Problem:** Conversation history lost on page reload; vim buffer only survives within session
- Impact: Users can't resume conversations; vim buffer is session-scoped despite appearing persistent
- Blocks: Multi-session workflows
- Recommendation: Store conversation history in localStorage with expiry

### No Rate Limit Visibility

**Problem:** Rate limit (50 messages/day/IP) is enforced server-side but user doesn't know they're approaching it
- Impact: User hits limit suddenly with no warning
- Files: `api/chat.ts` lines 32-34, 56-58
- Recommendation: Track remaining count on frontend; show warning at 10 messages remaining

---

## Build and Deployment

### Build Output Committed

**Problem:** `dist/` directory is committed to git
- Files: `dist/index.global.js`
- Impact: Repository size grows with every build; harder to review changes; potential for stale builds
- Recommendation: Add `dist/` to `.gitignore`; configure Vercel to build on deploy (or use CI)

### No Production Build Verification

**Problem:** No build step in test or pre-deploy script
- Files: `package.json` - no pre-commit hook or CI defined
- Impact: Breaking build errors not caught until deployment
- Recommendation: Add pre-commit hook to run `npm run build` or add GitHub Actions workflow

---

## Technical Debt Summary by Priority

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| Committed API key in history | CRITICAL | Account compromise | High |
| XTermAdapter too large | High | Maintainability | Medium |
| ShellEmulator too large | High | Maintainability | Medium |
| No tests | High | Reliability | High |
| Console logging in production | Medium | Debugging | Low |
| No offline capability | Medium | UX | Medium |
| No user feedback for API calls | Medium | UX | Low |
| legacy-peer-deps=true | Medium | Dependency health | Low |
| Audio loading delay | Low | Performance | Low |
| Bundle size | Low | Page load | Medium |

---

*Concerns audit: 2026-04-17*
