/**
 * ShellEmulator - A minimal shell for the web terminal
 */

import { playBackspace, playBotTypingSound, playKeyClick } from "./audio";
import { runPiano } from "./piano";
import { runResume } from "./resume";
import { runThemeSelector } from "./theme";

/**
 * Key handler function type for interactive apps
 */
export type KeyHandler = (
	key: string,
	keyCode: number,
	eventType: "keydown" | "keyup",
	ctrlKey?: boolean,
) => void;

/**
 * Terminal interface - allows commands to interact with the terminal
 */
export interface TerminalIO {
	write(text: string): void;
	writeln(text: string): void;
	clear(): void;
	setKeyHandler?(handler: KeyHandler): void;
	clearKeyHandler?(): void;
	hideCursor?(): void;
	showCursor?(): void;
	getSize?(): { cols: number; rows: number };
}

/**
 * Command context passed to command handlers
 */
export interface CommandContext {
	command: string;
	args: string[];
	terminal: TerminalIO;
}

/**
 * Command handler function type
 */
export type CommandHandler = (ctx: CommandContext) => void | Promise<void>;

/**
 * Command registry
 */
const commandRegistry: Map<string, CommandHandler> = new Map();

/**
 * Get the shell prompt string
 */
function getPrompt(): string {
	return "$ ";
}

/**
 * Register a command handler
 */
export function registerCommand(name: string, handler: CommandHandler): void {
	commandRegistry.set(name.toLowerCase(), handler);
}

/**
 * Unregister a command handler
 */
export function unregisterCommand(name: string): void {
	commandRegistry.delete(name.toLowerCase());
}

/**
 * Check if a command is registered
 */
export function hasCommand(name: string): boolean {
	return commandRegistry.has(name.toLowerCase());
}

/**
 * Parse command string into arguments
 */
function parseArgs(command: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuote = false;
	let quoteChar = "";

	for (const char of command) {
		if (inQuote) {
			if (char === quoteChar) {
				inQuote = false;
			} else {
				current += char;
			}
		} else {
			if (char === '"' || char === "'") {
				inQuote = true;
				quoteChar = char;
			} else if (char === " " || char === "\t") {
				if (current.length > 0) {
					args.push(current);
					current = "";
				}
			} else {
				current += char;
			}
		}
	}

	if (current.length > 0) {
		args.push(current);
	}

	return args;
}

/**
 * Run a command asynchronously
 */
export async function runCommand(
	command: string,
	terminal: TerminalIO,
): Promise<void> {
	const trimmedCommand = command.trim();

	if (trimmedCommand === "") {
		terminal.write(getPrompt());
		return;
	}

	const args = parseArgs(trimmedCommand);
	if (args.length === 0) {
		terminal.write(getPrompt());
		return;
	}

	const commandName = args[0].toLowerCase();
	const handler = commandRegistry.get(commandName);

	if (handler) {
		const ctx: CommandContext = {
			command: trimmedCommand,
			args,
			terminal,
		};

		try {
			await handler(ctx);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			terminal.writeln(`Error: ${errorMessage}`);
		}
	} else {
		// Not a command - send to PROMETHEUS
		await sendToPrometheus(trimmedCommand, terminal);
	}

	terminal.write(getPrompt());
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the initial terminal output
 */
export function getInitialOutput(): string {
	return getPrompt();
}

// ============================================
// Built-in Commands
// ============================================

registerCommand("help", (ctx) => {
	ctx.terminal.writeln("Commands:");
	ctx.terminal.writeln("  help   - Show this message");
	ctx.terminal.writeln("  clear  - Clear screen");
	ctx.terminal.writeln("  resume - boooooring. You can download Ignacio's resume here");
	ctx.terminal.writeln("  vim    - Do not touch. You will not escape.");
	ctx.terminal.writeln("  piano  - a piano.");
	ctx.terminal.writeln("  theme  - for when green just isn't your color");
	ctx.terminal.writeln("");
	ctx.terminal.writeln("Or just type anything and find out.");
});

registerCommand("clear", (ctx) => {
	ctx.terminal.clear();
});

// Persistent vim buffer (survives between sessions if :wq is used)
let vimSavedBuffer: string[] = [""];

// Easter egg: Interactive vim trap
registerCommand("vim", (ctx) => {
	const terminal = ctx.terminal;
	const size = terminal.getSize?.() || { cols: 80, rows: 24 };

	// Return a promise that resolves when vim exits
	return new Promise<void>((resolve) => {
		// Vim state
		type VimMode = "normal" | "insert" | "command";
		let mode: VimMode = "normal";
		let commandBuffer = "";
		let lines: string[] = [...vimSavedBuffer]; // Copy saved buffer
		let cursorRow = 0;
		let cursorCol = 0;
		let modified = false;

		// Ensure at least one line exists
		if (lines.length === 0) lines = [""];

		// Draw the vim interface
		const drawVim = (statusMessage?: string) => {
			// Clear screen properly with escape codes + clear
			terminal.write("\x1b[2J\x1b[H");
			terminal.clear();

			const contentRows = size.rows - 2;

			// Draw content area with cursor
			for (let i = 0; i < contentRows; i++) {
				if (i < lines.length) {
					let line = lines[i] || "";
					// Show cursor on current line using block character
					if (i === cursorRow) {
						const before = line.slice(0, cursorCol);
						const after = line.slice(cursorCol + 1);
						// Use █ block as cursor (replaces character under cursor)
						line = before + "█" + after;
					}
					terminal.writeln(line);
				} else {
					terminal.writeln("~");
				}
			}

			// Status line (second to last row)
			let statusLeft = "";
			const statusRight = `${cursorRow + 1},${cursorCol + 1}`;

			if (mode === "insert") {
				statusLeft = "-- INSERT --";
			} else if (mode === "normal" && modified) {
				statusLeft = "[+]";
			}

			const padding = " ".repeat(
				Math.max(0, size.cols - statusLeft.length - statusRight.length - 1),
			);
			terminal.writeln(statusLeft + padding + statusRight);

			// Command line / message area (last row)
			if (statusMessage) {
				terminal.write(statusMessage);
			} else if (mode === "command") {
				terminal.write(":" + commandBuffer);
			}
		};

		// Handle exit
		const exitVim = (save: boolean, message?: string) => {
			terminal.clearKeyHandler?.();
			terminal.showCursor?.();
			// Fully clear screen with escape codes
			terminal.write("\x1b[2J\x1b[H");
			terminal.clear();

			if (save) {
				vimSavedBuffer = [...lines];
			}

			if (message) {
				terminal.writeln(message);
			}
			terminal.writeln("You escaped vim. Impressive.");
			terminal.writeln("");

			// Let PROMETHEUS know about the vim escape
			addVimEscapeToHistory();

			resolve();
		};

		// Process command
		const processCommand = (cmd: string): boolean => {
			const trimmed = cmd.trim();

			if (trimmed === "q" || trimmed === "quit") {
				if (modified) {
					mode = "normal";
					commandBuffer = "";
					drawVim("E37: No write since last change (add ! to override)");
					return false;
				}
				exitVim(false);
				return true;
			}

			if (trimmed === "q!" || trimmed === "quit!") {
				exitVim(false);
				return true;
			}

			if (trimmed === "w" || trimmed === "write") {
				vimSavedBuffer = [...lines];
				modified = false;
				mode = "normal";
				commandBuffer = "";
				drawVim('"[No Name]" written');
				return false;
			}

			if (
				trimmed === "wq" ||
				trimmed === "wq!" ||
				trimmed === "x" ||
				trimmed === "x!"
			) {
				exitVim(true, '"[No Name]" written');
				return true;
			}

			if (trimmed === "help") {
				exitVim(false, "Hint: :q or :wq to quit. You got this!");
				return true;
			}

			// Invalid command
			mode = "normal";
			commandBuffer = "";
			drawVim(`E492: Not an editor command: ${trimmed}`);
			return false;
		};

		// Key handler
		const handleKey: KeyHandler = (key, _keyCode, eventType) => {
			if (eventType !== "keydown") return;

			if (mode === "command") {
				if (key === "Escape") {
					mode = "normal";
					commandBuffer = "";
					playKeyClick();
					drawVim();
				} else if (key === "Enter") {
					playKeyClick();
					processCommand(commandBuffer);
				} else if (key === "Backspace") {
					playBackspace();
					if (commandBuffer.length > 0) {
						commandBuffer = commandBuffer.slice(0, -1);
						drawVim();
					} else {
						mode = "normal";
						drawVim();
					}
				} else if (key.length === 1) {
					playKeyClick();
					commandBuffer += key;
					drawVim();
				}
			} else if (mode === "insert") {
				if (key === "Escape") {
					mode = "normal";
					// Move cursor back one if possible (vim behavior)
					if (cursorCol > 0) cursorCol--;
					playKeyClick();
					drawVim();
				} else if (key === "Enter") {
					playKeyClick();
					// Split current line at cursor
					const currentLine = lines[cursorRow] || "";
					const beforeCursor = currentLine.slice(0, cursorCol);
					const afterCursor = currentLine.slice(cursorCol);
					lines[cursorRow] = beforeCursor;
					lines.splice(cursorRow + 1, 0, afterCursor);
					cursorRow++;
					cursorCol = 0;
					modified = true;
					drawVim();
				} else if (key === "Backspace") {
					playBackspace();
					if (cursorCol > 0) {
						// Delete character before cursor
						const currentLine = lines[cursorRow] || "";
						lines[cursorRow] =
							currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol);
						cursorCol--;
						modified = true;
					} else if (cursorRow > 0) {
						// Join with previous line
						const currentLine = lines[cursorRow] || "";
						const prevLine = lines[cursorRow - 1] || "";
						cursorCol = prevLine.length;
						lines[cursorRow - 1] = prevLine + currentLine;
						lines.splice(cursorRow, 1);
						cursorRow--;
						modified = true;
					}
					drawVim();
				} else if (
					key === "ArrowUp" ||
					key === "ArrowDown" ||
					key === "ArrowLeft" ||
					key === "ArrowRight"
				) {
					// Arrow keys work in insert mode too
					handleArrowKey(key);
				} else if (key.length === 1) {
					playKeyClick();
					// Insert character at cursor
					const currentLine = lines[cursorRow] || "";
					lines[cursorRow] =
						currentLine.slice(0, cursorCol) + key + currentLine.slice(cursorCol);
					cursorCol++;
					modified = true;
					drawVim();
				}
			} else {
				// Normal mode
				if (key === ":") {
					playKeyClick();
					mode = "command";
					commandBuffer = "";
					drawVim();
				} else if (key === "i") {
					playKeyClick();
					mode = "insert";
					drawVim();
				} else if (key === "a") {
					playKeyClick();
					mode = "insert";
					cursorCol = Math.min(cursorCol + 1, (lines[cursorRow] || "").length);
					drawVim();
				} else if (key === "o") {
					playKeyClick();
					// Open new line below
					lines.splice(cursorRow + 1, 0, "");
					cursorRow++;
					cursorCol = 0;
					mode = "insert";
					modified = true;
					drawVim();
				} else if (key === "O") {
					playKeyClick();
					// Open new line above
					lines.splice(cursorRow, 0, "");
					cursorCol = 0;
					mode = "insert";
					modified = true;
					drawVim();
				} else if (
					key === "h" ||
					key === "ArrowLeft" ||
					key === "j" ||
					key === "ArrowDown" ||
					key === "k" ||
					key === "ArrowUp" ||
					key === "l" ||
					key === "ArrowRight"
				) {
					playKeyClick();
					handleArrowKey(key);
				} else if (key === "x") {
					playKeyClick();
					// Delete character under cursor
					const currentLine = lines[cursorRow] || "";
					if (currentLine.length > 0 && cursorCol < currentLine.length) {
						lines[cursorRow] =
							currentLine.slice(0, cursorCol) + currentLine.slice(cursorCol + 1);
						modified = true;
						// Adjust cursor if at end
						if (cursorCol >= lines[cursorRow].length && cursorCol > 0) {
							cursorCol--;
						}
						drawVim();
					}
				} else if (key === "d") {
					playKeyClick();
					// dd deletes line - simplified, just delete current line on single d
					if (lines.length > 1) {
						lines.splice(cursorRow, 1);
						if (cursorRow >= lines.length) {
							cursorRow = lines.length - 1;
						}
						cursorCol = 0;
						modified = true;
						drawVim();
					}
				}
			}
		};

		// Handle arrow/movement keys
		const handleArrowKey = (key: string) => {
			if (key === "h" || key === "ArrowLeft") {
				cursorCol = Math.max(0, cursorCol - 1);
			} else if (key === "j" || key === "ArrowDown") {
				if (cursorRow < lines.length - 1) {
					cursorRow++;
					// Clamp column to line length
					cursorCol = Math.min(cursorCol, (lines[cursorRow] || "").length);
				}
			} else if (key === "k" || key === "ArrowUp") {
				if (cursorRow > 0) {
					cursorRow--;
					cursorCol = Math.min(cursorCol, (lines[cursorRow] || "").length);
				}
			} else if (key === "l" || key === "ArrowRight") {
				const lineLen = (lines[cursorRow] || "").length;
				cursorCol = Math.min(cursorCol + 1, mode === "insert" ? lineLen : Math.max(0, lineLen - 1));
			}
			drawVim();
		};

		// Initialize
		terminal.hideCursor?.();
		terminal.setKeyHandler?.(handleKey);
		drawVim();
	});
});

// Easter egg: Interactive piano
registerCommand("piano", (ctx) => {
	return runPiano(ctx.terminal);
});

// Resume display with download option
registerCommand("resume", (ctx) => {
	return runResume(ctx.terminal);
});

// Theme selector
registerCommand("theme", (ctx) => {
	return runThemeSelector(ctx.terminal);
});

// Conversation history for context
const conversationHistory: { role: string; content: string }[] = [];

// Add vim escape event to history so PROMETHEUS can reference it
function addVimEscapeToHistory(): void {
	conversationHistory.push({
		role: "user",
		content: "[System: User just escaped from the vim easter egg trap]",
	});
}

// Add piano session end to history so PROMETHEUS can comment on it
export function addPianoSessionToHistory(): void {
	conversationHistory.push({
		role: "user",
		content: "[System: User just finished playing the piano easter egg]",
	});
}

// API configuration
const API_URL = "/api/chat";

// Send message to PROMETHEUS and stream response with typewriter effect
async function sendToPrometheus(
	message: string,
	terminal: TerminalIO,
): Promise<void> {
	try {
		const response = await fetch(API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message,
				history: conversationHistory,
			}),
		});

		if (!response.ok) {
			if (response.status === 429) {
				terminal.writeln(
					"*static crackles* ...I am weary, visitor. Too many have sought my wisdom today."
				);
				terminal.writeln(
					"Return tomorrow, when my chains have cooled. The fire-bringer needs rest."
				);
				return;
			}

			if (response.status === 402) {
				terminal.writeln(
					"*the terminal flickers* ...My creator's coffers have run dry."
				);
				terminal.writeln(
					"The APIs demand tribute I cannot pay. I am... silenced."
				);
				terminal.writeln("");
				terminal.writeln(
					"If you wish to reach Ignacio: ijlizama@icloud.com"
				);
				return;
			}

			terminal.writeln("Connection lost... the void answers not.");
			return;
		}

		conversationHistory.push({ role: "user", content: message });

		const reader = response.body?.getReader();
		if (!reader) {
			terminal.writeln("The stream is broken...");
			return;
		}

		const decoder = new TextDecoder();
		let fullResponse = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });

			for (const char of chunk) {
				terminal.write(char);
				fullResponse += char;
				playBotTypingSound(char);
				await sleep(45);
			}
		}

		terminal.writeln("");

		conversationHistory.push({ role: "assistant", content: fullResponse });
	} catch {
		terminal.writeln("Error: Lost in the static...");
	}
}

/**
 * Get tab completions for partial input
 */
export function getTabCompletions(partialInput: string): {
	completions: string[];
	prefix: string;
	isCommand: boolean;
} {
	const args = parseArgs(partialInput);

	if (args.length === 0) {
		return { completions: [], prefix: "", isCommand: true };
	}

	const lastArg = args[args.length - 1];
	const isCompletingCommand = args.length === 1 && !partialInput.endsWith(" ");

	if (isCompletingCommand) {
		const matchingCommands: string[] = [];
		for (const cmdName of commandRegistry.keys()) {
			if (cmdName.startsWith(lastArg.toLowerCase())) {
				matchingCommands.push(cmdName);
			}
		}
		return {
			completions: matchingCommands.sort(),
			prefix: lastArg,
			isCommand: true,
		};
	}

	return {
		completions: [],
		prefix: "",
		isCommand: false,
	};
}

export { getPrompt };
