# Technology Stack

**Analysis Date:** 2026-04-17

## Languages

**Primary:**
- TypeScript 5.7.2 - Full application development, strong type safety
- HTML5 - Application markup and landing pages

**Secondary:**
- JavaScript - Runtime output from TypeScript transpilation
- GLSL/Shaders - WebGL rendering via Three.js

## Runtime

**Environment:**
- Browser-based (modern WebGL-capable browsers)
- Node.js - Build-time only (via tsup)
- Vercel Edge Runtime - Serverless API execution (`@vercel/node` v5.0.0)

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` (present)
- Configuration: `.npmrc` with `legacy-peer-deps=true` for compatibility

## Frameworks

**Core:**
- Three.js 0.182.0 - 3D rendering engine for WebGL terminal display
- xterm.js (@xterm/xterm) 6.0.0 - Terminal emulation in browser
- cool-retro-term-renderer 1.0.0 - Retro CRT effect rendering

**API/Backend:**
- Anthropic SDK (@anthropic-ai/sdk) 0.52.0 - Claude API integration
- Vercel KV (@vercel/kv) 3.0.0 - Distributed cache/rate limiting
- Vercel Node (@vercel/node) 5.0.0 - Serverless function runtime

**Build/Dev:**
- tsup 8.3.5 - TypeScript bundler and minifier
- concurrently 9.2.1 - Run multiple dev processes in parallel
- http-server 14.1.1 - Local development HTTP server
- TypeScript 5.7.2 - Language compiler
- Biome 2.3.10 - Linting and formatting (via CLI)

## Key Dependencies

**Critical:**
- Three.js 0.182.0 - Entire visual rendering depends on this. Used for scene setup, camera, WebGL renderer initialization
- @xterm/xterm 6.0.0 - Terminal I/O foundation. Manages scrollback, cursor, text rendering
- cool-retro-term-renderer 1.0.0 - Custom dependency providing TerminalFrame and TerminalText classes with CRT shader effects
- @anthropic-ai/sdk 0.52.0 - AI conversation feature. Streams Claude responses via `/api/chat`

**Infrastructure:**
- @vercel/kv 3.0.0 - Redis-compatible key-value store. Used for rate limiting (per-IP request tracking)
- @vercel/node 5.0.0 - Vercel serverless function types and request/response handling
- stats.js 0.17.0 - FPS/performance monitoring overlay (optional, in HTML)

**Rendering:**
- @types/three 0.182.0 - TypeScript types for Three.js
- @types/stats.js 0.17.4 - TypeScript types for performance monitor

## Configuration

**Environment:**
- `.env` file present - Contains `ANTHROPIC_API_KEY`, `SYSTEM_PROMPT`, and other secrets (see note below)
- Environment variables loaded at runtime:
  - `ANTHROPIC_API_KEY` - Claude API authentication (required for production)
  - `SYSTEM_PROMPT` - AI personality/system instructions (can be in env or `api/system-prompt.ts` for local dev)

**Build:**
- `tsup.config.ts` - Bundler configuration
  - Output: IIFE format (self-executing browser bundle)
  - Output directory: `./dist`
  - Global name: `CoolRetroTerm`
  - Bundle: All dependencies included (no external references)
  - Platform: Browser
  - Minification: Enabled
- `tsconfig.json` - TypeScript compilation settings
  - Target: ESNext
  - Module: ESNext
  - Module resolution: bundler
  - Strict mode: Enabled
  - Output directory: `./dist`

**Code Quality:**
- `biome.json` - Code formatting and linting
  - Formatter: Tab indentation
  - Linter: Recommended rules enabled
  - Import organization: Enabled
  - JavaScript quote style: Double quotes

## Platform Requirements

**Development:**
- Node.js (latest stable)
- Modern terminal/shell
- npm installed
- Browser with WebGL support and Web Audio API
- Keyboard for terminal interaction (desktop only)

**Production:**
- Vercel hosting platform (deployment target)
- Static file serving (HTML, built JS, assets)
- Serverless function support for `/api/chat` endpoint
- Redis-compatible KV store access (via Vercel KV)
- Anthropic API connectivity

## Deployment

**Target:**
- Vercel Platform
- Configuration file: `vercel.json`
  - Build command: `npm run build`
  - Output directory: `.` (root, serves everything including `dist/`)
  - CORS headers configured for `/api/*` routes
  - No framework detection (null)

---

*Stack analysis: 2026-04-17*
