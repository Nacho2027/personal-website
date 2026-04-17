# Testing Patterns

**Analysis Date:** 2026-04-17

## Test Framework

**Status:** No automated test framework configured

**Runner:**
- Not applicable - no test runner installed or configured
- Package scripts: `"test": "echo \"Error: no test specified\" && exit 1"` (see `package.json` line 10)

**Assertion Library:**
- Not applicable

**Test Files:**
- No test files found in `src/` directory
- Glob search for `*.test.ts`, `*.test.js`, `*.spec.ts` returned no matches in project code
- Only test files found are in `node_modules/` (external dependency tests for `meshoptimizer`)

**Run Commands:**
```bash
npm test              # Currently returns error - no tests specified
```

## Test Coverage

**Requirements:** None enforced

**Current Coverage:** 0% - no automated tests

**View Coverage:**
- Not applicable - no coverage tooling configured

## Why Tests Are Absent

This is a **single-page personal website application** (terminal emulator with interactive commands). Testing decisions:

1. **Heavy DOM/Browser API Usage** - Core functionality relies on:
   - xterm.js terminal emulation
   - Three.js WebGL rendering
   - Web Audio API for sounds
   - DOM manipulation for keyboard/mouse events
   - Browser-specific APIs (clipboard, screen size, user agent detection)

2. **Interactive State Machine Logic** - Complex behavioral logic (vim mode, command execution, terminal I/O) would require:
   - Full DOM environment simulation
   - Browser API mocking
   - Extensive setup/teardown for interactive tests

3. **Project Scope** - Personal portfolio website where:
   - Manual testing during development is practical
   - User acceptance testing is the primary validation
   - Code changes are infrequent
   - Risk of regression is low (contained interactive features)

## Testing Strategy (Current)

**Manual Testing Approach:**
- Live testing in browser during development: `npm run dev:local` (see `package.json` line 8)
- Interactive features tested directly:
  - Terminal commands: `help`, `clear`, `vim`, `piano`, `theme`, `resume`
  - vim easter egg mode (enter/exit, insert/normal mode transitions, save/quit)
  - Piano synthesis (key press sound feedback)
  - Theme switching with preview
  - Terminal history navigation (arrow up/down)
  - Mobile responsiveness check
  - Keyboard input and clipboard paste

- Build verification: `npm run build` runs tsup minification and bundle integrity check

**Code Review** (implied):
- TypeScript strict mode catches type errors
- Biome linter enforces conventions
- Manual code inspection for complex logic (especially vim state machine)

## Areas That Would Benefit from Tests (If Testing Were Added)

**Core Logic to Test (if future testing is needed):**

**1. Command Parsing:** `ShellEmulator.ts` lines 84-117
```typescript
function parseArgs(command: string): string[] {
  // Complex string parsing with quote handling
  // Edge cases: empty strings, escaped quotes, whitespace
}
```

**2. Command Registry:** `ShellEmulator.ts` lines 63-79
```typescript
export function registerCommand(name: string, handler: CommandHandler): void
export function unregisterCommand(name: string): void
export function hasCommand(name: string): boolean
```
Would benefit from unit tests for:
- Command registration/unregistration
- Case-insensitive lookup
- Command existence checks

**3. History Navigation:** `XTermAdapter.ts` lines 756-789
```typescript
private navigateHistoryUp(): void
private navigateHistoryDown(): void
```
Would need integration tests for:
- Navigating forward/backward through command history
- Boundary conditions (first/last command)
- Saving/restoring current line while navigating

**4. Mobile Detection:** `src/utils.ts` lines 15-25
```typescript
export function isMobileDevice(): boolean {
  // User agent detection + screen width check
}
```
Would benefit from unit tests:
- Mock different user agents (iOS, Android, desktop)
- Test screen width boundaries (<1080px)
- Verify caching behavior (single check per session)

**5. Vim Mode State Machine:** `ShellEmulator.ts` lines 209-500
```typescript
type VimMode = "normal" | "insert" | "command";
// Complex state transitions and buffer manipulation
```
Would need extensive integration tests:
- Mode transitions (normal → insert → command)
- Character insertion/deletion
- Line operations (split, join, delete)
- Command execution (w, q, wq, etc.)
- Modified flag tracking
- Escape handling in each mode

## Testing Recommendations for Future Development

If this project grows or gains more complex features:

1. **Add Jest or Vitest:**
   ```bash
   npm install --save-dev jest @testing-library/dom @testing-library/user-event
   npm install --save-dev @types/jest
   ```

2. **Test Configuration:**
   - Set up `jest.config.js` for JSDOM environment (browser simulation)
   - Configure TypeScript support: `ts-jest` preset
   - DOM testing utilities: `@testing-library/dom` for user-centric tests
   - Mock Web Audio API and Three.js if needed

3. **Test Structure:**
   - Co-locate tests with source: `src/terminal/__tests__/ShellEmulator.test.ts`
   - Test behavior, not implementation (especially state machines)
   - Use helper functions for common setup (audio context mocking, terminal creation)

4. **Priority Test Targets:**
   1. Command parsing and registry (unit tests) - lowest risk if broken
   2. Mobile detection (unit tests) - independent function
   3. Vim mode state machine (integration tests) - highest complexity
   4. History navigation (integration tests) - user-critical
   5. Theme switching (integration tests) - critical user feature

## Development Workflow (Current)

**Before Committing:**
1. Run linter: `npm run lint-and-format`
2. Run build: `npm run build`
3. Manual testing in browser: `npm run dev:local`
4. Check for console errors/warnings

**Build Process:**
- Entry point: `src/index.ts`
- Output: `dist/index.js` (IIFE bundle)
- Minification: enabled
- Platform: browser
- Module format: IIFE (Immediately Invoked Function Expression)
- Config: `tsup.config.ts` (lines 1-16)

---

*Testing analysis: 2026-04-17*
