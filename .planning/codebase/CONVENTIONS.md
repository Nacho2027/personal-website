# Coding Conventions

**Analysis Date:** 2026-04-17

## Naming Patterns

**Files:**
- PascalCase for classes: `XTermAdapter.ts`, `ShellEmulator.ts`
- camelCase for utility/module files: `index.ts`, `utils.ts`, `audio.ts`, `theme.ts`, `piano.ts`
- Extension: TypeScript files use `.ts`

**Functions:**
- camelCase for all functions: `runScene()`, `getPrompt()`, `registerCommand()`, `isMobileDevice()`
- Verb-first pattern for action functions: `runCommand()`, `playBackspace()`, `startAmbientAudio()`
- Getter pattern for query functions: `getInitialOutput()`, `getCurrentTheme()`, `getTabCompletions()`
- Boolean predicates use `is` prefix: `isMobileDevice()`, `hasCommand()`

**Variables:**
- camelCase for all variable declarations: `currentLine`, `isCommandRunning`, `bootComplete`, `commandHistory`
- Private class members use `private` keyword with camelCase: `private gameKeyHandler`, `private outputBuffer`
- Constants (within modules) are UPPERCASE: `PASTE_COOLDOWN_MS = 500`, `API_URL = "/api/chat"`
- Configuration objects use camelCase: `imageData`, `gridSize`, `terminalText`

**Types:**
- PascalCase for interface names: `TerminalIO`, `CommandContext`, `KeyHandler`, `Theme`, `TerminalTextRenderer`
- Type aliases use PascalCase: `VimMode` (type union like `"normal" | "insert" | "command"`)
- `type` keyword for function signatures and unions, `interface` for object contracts

## Code Style

**Formatting:**
- Tool: Biome (configured in `biome.json`)
- Indentation: Tabs (enforced by Biome)
- Quote style: Double quotes (enforced for JavaScript/TypeScript)

**Linting:**
- Tool: Biome with recommended rules enabled
- VCS integration: Git-aware linting enabled
- Run command: `npm run lint-and-format` - Runs Biome check with --write and --unsafe flags
- Note: `biome-ignore` comments used sparingly for false positives (e.g., `// biome-ignore lint/correctness/noUnusedPrivateClassMembers: property is used via this.outputBuffer`)

**Line Length:**
- No explicit line length limit in config, but code generally respects ~100 character boundary
- Long function signatures are broken across multiple lines (see `XTermAdapter.ts` event handlers)

## Import Organization

**Order:**
1. External library imports (e.g., `import * as THREE from "three"`)
2. Internal relative imports (e.g., `import { TerminalFrame } from "cool-retro-term-renderer"`)
3. Type imports (using `type` keyword): `import type { TerminalText } from "cool-retro-term-renderer"`
4. Side effect imports last (none in this codebase)

**Path Aliases:**
- None configured. All imports are relative paths.
- Barrel files not used.

**Example:** In `src/terminal/XTermAdapter.ts`:
```typescript
import { Terminal } from "@xterm/xterm";
import type { TerminalText } from "cool-retro-term-renderer";
import { isMobileDevice } from "../utils";
import {
  getInitialOutput,
  getTabCompletions,
  type KeyHandler,
  runCommand,
  type TerminalIO,
} from "./ShellEmulator";
```

## Error Handling

**Patterns:**
- Explicit error type checking: `error instanceof Error ? error.message : String(error)` (see `ShellEmulator.ts` line 152-154)
- Try-catch blocks for async operations: `runScene().catch(console.error)` (see `index.ts` line 81)
- Graceful fallbacks for optional operations:
  - Check existence before access: `terminal.getSize?.() || { cols: 80, rows: 24 }` (optional chaining)
  - Guard clauses for early exits in functions
  - Explicit null/undefined checks before using values

**Error Messages:**
- User-facing messages are descriptive and metaphorical (fits the terminal theme): "Connection lost... the void answers not."
- Console warnings for non-critical issues: `console.warn("Could not read clipboard:", err)`
- System-level errors wrapped in Error objects

## Logging

**Framework:** `console` (native browser console)

**Patterns:**
- Minimal console output in production
- `console.error()` for unhandled promise rejections: `runScene().catch(console.error)`
- `console.warn()` for non-fatal issues: `console.warn("Could not read clipboard:", err)`
- No structured logging framework (single-page app doesn't require it)

**Comments:**
- File-level JSDoc comments at top of file: `/** Ignacio Lizama - Personal Terminal Website */`
- Function/method JSDoc comments before declaration
- Inline comments explain WHY (algorithm logic), not WHAT (code is self-explanatory)
- Comments for non-obvious behavior (e.g., "Vim state" section in `ShellEmulator.ts`)

## Comments

**When to Comment:**
- Complex algorithms or state machines: vim mode handler in `ShellEmulator.ts` has comments for each mode transition
- Non-obvious data structure usage: "Ensure at least one line exists" before vim drawing
- Integration points with external libraries: `// Preload audio samples` before `initAudio()`
- Business logic that isn't self-documenting: "Vim buffer survives between sessions if :wq is used"

**JSDoc/TSDoc:**
- Used for public exported functions and interfaces
- Example from `ShellEmulator.ts`:
```typescript
/**
 * Register a command handler
 */
export function registerCommand(name: string, handler: CommandHandler): void {
  commandRegistry.set(name.toLowerCase(), handler);
}
```
- Parameter and return types documented via TypeScript signatures, not in JSDoc
- Only document WHY in JSDoc, not WHAT (types are in code)

## Function Design

**Size:**
- Functions range 10-100+ lines
- Longer functions used for complex state machines (e.g., vim mode handler ~400 lines)
- Single responsibility: each function handles one concern
- Early returns reduce nesting: `if (!container) { throw new Error(...) }` at start of functions

**Parameters:**
- Prefer explicit parameters over options objects for <= 3 parameters
- Use interfaces for complex option objects: `TerminalIO`, `CommandContext`
- Type all parameters (strict TypeScript mode enabled)
- Default parameters used: `cols: number = 80, rows: number = 24` in XTermAdapter constructor

**Return Values:**
- Explicit return types in function signatures (TypeScript strict mode)
- Void for side effects: `function handleKey(): void`
- Promise types for async: `async function runCommand(): Promise<void>`
- Union types for multiple return paths: `getTabCompletions()` returns object with `{ completions, prefix, isCommand }`
- No implicit returns of undefined

## Module Design

**Exports:**
- Named exports for utilities: `export function isMobileDevice()`, `export function registerCommand()`
- Class exports: `export class XTermAdapter`
- Type exports: `export interface TerminalIO`, `export type KeyHandler`
- Default exports not used (project uses named exports consistently)

**Module Structure:**
- Utility modules (`src/utils.ts`) contain pure functions
- Command registration in `ShellEmulator.ts` done at module level via `registerCommand()`
- Stateful classes encapsulate behavior: `XTermAdapter` class manages terminal state
- Theme module (`src/terminal/theme.ts`) uses module-level state with getters/setters

**Barrel Files:**
- Not used in this codebase
- Direct imports from specific files

---

*Convention analysis: 2026-04-17*
