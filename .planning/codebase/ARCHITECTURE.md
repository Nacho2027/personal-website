# Architecture

**Analysis Date:** 2026-04-17

## Pattern Overview

**Overall:** Client-rendered terminal emulator with server-side AI streaming backend

**Key Characteristics:**
- Full-stack TypeScript (frontend + serverless API)
- Three-layer rendering: WebGL canvas (three.js) → Terminal text/frame → xterm.js command interface
- Stateless API with rate limiting and streaming responses
- Easter egg-driven interactivity (vim, piano, theme switcher)
- Conversation history maintained in frontend memory

## Layers

**Rendering Layer (Frontend):**
- Purpose: Displays retro CRT terminal UI with visual effects (bloom, scanlines, screen curvature)
- Location: `src/index.ts`
- Contains: Three.js scene setup, TerminalFrame/TerminalText from cool-retro-term-renderer, animation loop
- Depends on: cool-retro-term-renderer, three.js, xterm.js
- Used by: Browser DOM entry point

**Terminal Emulation Layer (Frontend):**
- Purpose: Bridges xterm.js (hidden off-screen) with TerminalText renderer and shell command execution
- Location: `src/terminal/XTermAdapter.ts` (885 lines)
- Contains: Keyboard/mouse event handling, selection, clipboard, history navigation, game-mode key routing
- Depends on: xterm library, ShellEmulator, audio/theme/utils modules
- Used by: index.ts, routes user input to shell

**Shell Emulation Layer (Frontend):**
- Purpose: Command parsing, registry, execution, conversation history management
- Location: `src/terminal/ShellEmulator.ts` (685 lines)
- Contains: Built-in commands (help, clear, vim, piano, resume, theme), command registry, argument parsing, API routing
- Depends on: audio, piano, resume, theme modules, Anthropic streaming API
- Used by: XTermAdapter for command execution

**Interactive Features (Frontend):**
- Purpose: Game-mode applications (vim editor, piano, theme selector)
- Location: `src/terminal/` (theme.ts, piano.ts, resume.ts, audio.ts)
- Contains: State machines and key handlers for each interactive mode
- Depends on: ShellEmulator interfaces, audio context
- Used by: ShellEmulator via command handlers

**API Layer (Backend):**
- Purpose: Serverless API endpoint for AI chat with rate limiting and streaming
- Location: `api/chat.ts`
- Contains: Rate limit checking (IP-based, 50/day via Vercel KV), Claude Haiku streaming, error handling
- Depends on: Anthropic SDK, Vercel KV, system prompt
- Used by: Frontend fetch requests from ShellEmulator

**Configuration Layer:**
- Purpose: System prompt (AI personality and knowledge base)
- Location: `api/system-prompt.ts` (gitignored in production, env var in Vercel)
- Contains: PROMETHEUS persona, Ignacio's profile, response guidelines, easter egg handling
- Depends on: None
- Used by: api/chat.ts for Claude context

## Data Flow

**Startup Flow:**

1. Browser loads `index.html`
2. `src/index.ts` initializes Three.js scene with TerminalFrame and TerminalText meshes
3. XTermAdapter created, hidden xterm instance initialized off-screen
4. Audio samples preloaded (key clicks, backspace, ambient)
5. Boot message displayed via xterm.write() → TerminalText.setText()
6. Animation loop starts (requestAnimationFrame)
7. User presses ENTER to proceed past boot screen

**Command Execution Flow:**

1. User types text in XTermAdapter (handleKey, handleBackspace, handleEnter)
2. XTermAdapter.executeCommand() called on ENTER
3. Calls ShellEmulator.runCommand(commandString, terminalIO)
4. ShellEmulator parses command, checks registry (e.g., "help", "vim", "piano")
5. If registered: Handler executed with CommandContext (terminal IO, args)
6. If not registered: Treated as message to AI → ShellEmulator.sendToPrometheus()

**AI Chat Flow:**

1. ShellEmulator.sendToPrometheus(message, terminal) called with user input
2. Conversation history appended with user message
3. POST to `/api/chat` with message + history
4. Backend (api/chat.ts) receives request, checks rate limit via Vercel KV
5. Claude Haiku called with system prompt + message history
6. Response streamed back (Content-Type: text/plain, chunked)
7. Frontend reads stream char-by-char, writes to xterm, plays typewriter sounds
8. Response appended to conversation history
9. Prompt displayed again

**Interactive Mode Flow (vim/piano/theme):**

1. Command handler registers custom KeyHandler via terminalIO.setKeyHandler()
2. XTermAdapter.gameKeyHandler set, blocking normal command processing
3. Document-level keydown/keyup listeners route to registered handler
4. Handler manages mode state (draw screen, process input)
5. On exit: clearKeyHandler() called, normal command mode resumes

**State Management:**

- Conversation history: ShellEmulator.conversationHistory (frontend memory, lost on page reload)
- Command history: XTermAdapter.commandHistory (navigation with arrow keys)
- Terminal state: XTermAdapter properties (currentLine, isCommandRunning, bootComplete, etc.)
- Game mode state: Isolated in interactive command handlers (vim lines buffer, piano note state, etc.)
- Theme state: Stored in TerminalText properties (bloom, brightness, scanlines, etc.)

## Key Abstractions

**TerminalIO Interface:**
- Purpose: Abstraction for terminal output/input used by commands
- Examples: `src/terminal/ShellEmulator.ts` line 23
- Pattern: Dependency injection—commands receive TerminalIO for write/writeln/clear/setKeyHandler/hideCursor
- Enables: Commands to work without knowing about xterm/TerminalText internals

**CommandHandler Type:**
- Purpose: Callable function signature for registered commands
- Examples: `registerCommand("help", (ctx) => { ... })`
- Pattern: Higher-order function registry—handleCommand(name, fn) stores fn, invokes on match
- Enables: Extensible command system without modifying core

**KeyHandler Type:**
- Purpose: Callback for handling keyboard input in interactive modes
- Examples: vim command mode detects ":" to enter command mode
- Pattern: Game-mode pattern—custom handlers intercept events during active game
- Enables: Full keyboard control for interactive applications

**Theme Configuration:**
- Purpose: Encapsulates CRT effect parameters (bloom, scanlines, curvature, etc.)
- Examples: THEMES array in `src/terminal/theme.ts` (line 35)
- Pattern: Data-driven themes—each theme is immutable config object
- Enables: Runtime switching without re-rendering canvas

## Entry Points

**`index.html`:**
- Location: `/index.html`
- Triggers: Browser loads page
- Responsibilities: Sets viewport, defines container div, loads built script

**`src/index.ts`:**
- Location: `/src/index.ts` (81 lines)
- Triggers: Script execution on page load
- Responsibilities: Initialize three.js scene, setup rendering loop, wire up resize handlers, coordinate all components

**`api/chat.ts`:**
- Location: `/api/chat.ts` (164 lines)
- Triggers: POST request from frontend to `/api/chat`
- Responsibilities: Rate limit check, Claude API streaming, error handling (429, 402, 500)

**Mobile Entry:**
- Handles mobile detection in `src/terminal/XTermAdapter.ts` (line 345)
- Shows message instead of full terminal interface on small screens

## Error Handling

**Strategy:** Defensive with fallback messages

**Patterns:**

- **API Failures**: 
  - 429 (rate limit): Show "too many visitors" message in terminal
  - 402 (quota/billing): Show "coffers run dry" message with contact info
  - 500 (server error): Generic "void answers not" message

- **Audio Loading**: 
  - Wrapped in try/catch in `src/terminal/audio.ts`, console.warn on fail
  - Non-blocking—game continues without sound

- **Command Errors**: 
  - Caught in ShellEmulator.runCommand (line 149), displayed as "Error: {message}"
  - vim editor shows vim-style error messages (E37, E492)

- **DOM Errors**: 
  - Container element check in src/index.ts (line 13) throws if not found
  - Grid size validation before resize calls

- **Terminal Grid Size**: 
  - Validation in index.ts (lines 44-47, 66-68) ensures cols/rows > 0
  - Fallback to default 80x24 if invalid

## Cross-Cutting Concerns

**Logging:** 
- client: console.error for API errors, console.warn for audio/clipboard failures
- server: console.error for Claude API errors, rate limit check failures

**Validation:** 
- Frontend: parseArgs() validates quoted strings, isMobileDevice() checks viewport
- Backend: req.body validation for message/history in api/chat.ts (lines 101-106)

**Authentication:** 
- Server-side only: Vercel KV for rate limiting per IP
- No user login—public terminal, rate-limited by IP address

**Audio Context:** 
- Single shared context per page (getAudioContext singleton)
- Resume on first user interaction (startAmbientAudio in XTermAdapter.handleEnter line 653)
- Handles browser autoplay policy (suspended state)

**Mobile Handling:** 
- Detected in utils.ts via user agent + screen width < 1080px
- Cached on first call for performance
- Blocks keyboard handlers, shows text-only boot message

---

*Architecture analysis: 2026-04-17*
