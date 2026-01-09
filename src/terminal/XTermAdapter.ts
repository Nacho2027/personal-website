/**
 * XTermAdapter - Integrates xterm.js with the TerminalText renderer
 */

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
import {
	initAudio,
	playBackspace,
	playKeyClick,
	startAmbientAudio,
} from "./audio";

export class XTermAdapter {
	private xterm: Terminal;
	private terminalText: TerminalText;
	private currentLine: string = "";
	private hiddenContainer: HTMLDivElement;
	private isCommandRunning: boolean = false;
	private bootComplete: boolean = false;

	private commandHistory: string[] = [];
	private historyIndex: number = -1;
	private savedCurrentLine: string = "";

	private gameKeyHandler: KeyHandler | null = null;

	private lastPasteTime: number = 0;
	private static readonly PASTE_COOLDOWN_MS: number = 500;

	private isSelecting: boolean = false;
	private selectionStart: { col: number; row: number } | null = null;

	private boundGameKeyboardHandler: ((event: KeyboardEvent) => void) | null =
		null;

	private cursorExplicitlyHidden: boolean = false;

	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: property is used via this.outputBuffer
	private outputBuffer: string = "";

	constructor(
		terminalText: TerminalText,
		cols: number = 80,
		rows: number = 24,
	) {
		this.terminalText = terminalText;

		this.hiddenContainer = document.createElement("div");
		this.hiddenContainer.style.position = "absolute";
		this.hiddenContainer.style.left = "-9999px";
		this.hiddenContainer.style.top = "-9999px";
		this.hiddenContainer.style.width = "800px";
		this.hiddenContainer.style.height = "600px";
		document.body.appendChild(this.hiddenContainer);

		const gridSize = terminalText.getGridSize();
		const actualCols = gridSize.cols > 0 ? gridSize.cols : cols;
		const actualRows = gridSize.rows > 0 ? gridSize.rows : rows;

		this.xterm = new Terminal({
			cols: actualCols,
			rows: actualRows,
			cursorBlink: false,
			cursorStyle: "block",
			scrollback: 1000,
			fontFamily: "Terminus, monospace",
			fontSize: 12,
		});

		this.xterm.open(this.hiddenContainer);

		// Preload audio samples
		initAudio();

		this.showBootPrompt();

		this.xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
			if (isMobileDevice()) {
				return false;
			}

			if (this.gameKeyHandler) {
				// Block xterm from processing - document listener handles the key
				event.preventDefault();
				event.stopPropagation();
				return false;
			}

			if (event.key === "ArrowUp" || event.keyCode === 38) {
				if (event.type === "keydown") {
					this.handleArrowUp();
				}
				return false;
			}

			if (event.key === "ArrowDown" || event.keyCode === 40) {
				if (event.type === "keydown") {
					this.handleArrowDown();
				}
				return false;
			}

			if (
				event.key === "ArrowLeft" ||
				event.keyCode === 37 ||
				event.key === "ArrowRight" ||
				event.keyCode === 39
			) {
				return false;
			}

			if (
				event.key === "Home" ||
				event.keyCode === 36 ||
				event.key === "End" ||
				event.keyCode === 35
			) {
				return false;
			}

			if (event.key === "Tab" || event.keyCode === 9) {
				if (event.type === "keydown") {
					this.handleTab();
				}
				event.preventDefault();
				return false;
			}

			if (event.key === "Backspace" || event.keyCode === 8) {
				if (event.type === "keydown") {
					this.handleBackspace();
				}
				event.preventDefault();
				return false;
			}

			if (event.key === "Enter" || event.keyCode === 13) {
				if (event.type === "keydown") {
					this.handleEnter();
				}
				event.preventDefault();
				return false;
			}

			return true;
		});

		this.xterm.onKey(({ key, domEvent }) => {
			if (isMobileDevice()) {
				return;
			}
			// Don't process when game/vim key handler is active (document listener handles it)
			if (this.gameKeyHandler) {
				return;
			}
			this.handleKey(key, domEvent);
		});

		this.xterm.onData((data) => {
			if (isMobileDevice()) {
				return;
			}
			// Don't process data when game/vim key handler is active
			if (this.gameKeyHandler) {
				return;
			}
			if (
				!this.isCommandRunning &&
				data.length > 1 &&
				!data.includes("\r") &&
				!data.includes("\n")
			) {
				this.currentLine += data;
				this.xterm.write(data);
				this.updateTerminalText();
			}
		});

		this.xterm.onScroll(() => {
			this.updateTerminalText();
		});

		const container = document.getElementById("container");
		if (container) {
			container.addEventListener(
				"wheel",
				(event: WheelEvent) => {
					if (this.gameKeyHandler) {
						event.preventDefault();
						return;
					}
					const lines =
						Math.sign(event.deltaY) *
						Math.max(1, Math.floor(Math.abs(event.deltaY) / 50));
					this.xterm.scrollLines(lines);
					this.updateTerminalText();
					event.preventDefault();
				},
				{ passive: false },
			);

			container.addEventListener("contextmenu", (event: MouseEvent) => {
				event.preventDefault();
				event.stopPropagation();

				if (isMobileDevice()) {
					return;
				}

				if (!this.bootComplete || this.isCommandRunning) {
					return;
				}

				if (this.gameKeyHandler) {
					return;
				}

				const selection = this.terminalText.getSelection();
				if (selection.start && selection.end) {
					return;
				}

				const now = Date.now();
				if (now - this.lastPasteTime < XTermAdapter.PASTE_COOLDOWN_MS) {
					return;
				}
				this.lastPasteTime = now;

				navigator.clipboard
					.readText()
					.then((text) => {
						if (text) {
							const cleanText = text.replace(/[\r\n]/g, "");
							if (cleanText.length > 0) {
								this.currentLine += cleanText;
								this.xterm.write(cleanText, () => {
									this.updateTerminalText();
									this.xterm.focus();
								});
							}
						}
					})
					.catch((err) => {
						console.warn("Could not read clipboard:", err);
					});
			});

			container.addEventListener("mousedown", (event: MouseEvent) => {
				if (event.button !== 0) {
					return;
				}

				if (isMobileDevice()) {
					return;
				}

				if (this.gameKeyHandler) {
					return;
				}

				const rect = container.getBoundingClientRect();
				const x = event.clientX - rect.left;
				const y = event.clientY - rect.top;
				const gridPos = this.terminalText.pixelToGrid(x, y);

				const viewportY = this.xterm.buffer.active.viewportY;
				const absPos = { col: gridPos.col, row: gridPos.row + viewportY };

				this.isSelecting = true;
				this.selectionStart = absPos;

				this.terminalText.setSelection(absPos, absPos, viewportY);

				event.preventDefault();
			});

			container.addEventListener("mousemove", (event: MouseEvent) => {
				if (!this.isSelecting || !this.selectionStart) {
					return;
				}

				const rect = container.getBoundingClientRect();
				const x = event.clientX - rect.left;
				const y = event.clientY - rect.top;
				const gridPos = this.terminalText.pixelToGrid(x, y);

				const viewportY = this.xterm.buffer.active.viewportY;
				const absPos = { col: gridPos.col, row: gridPos.row + viewportY };

				this.terminalText.setSelection(this.selectionStart, absPos, viewportY);
			});

			container.addEventListener("mouseup", (event: MouseEvent) => {
				if (event.button !== 0) {
					return;
				}

				if (this.isSelecting && this.selectionStart) {
					const rect = container.getBoundingClientRect();
					const x = event.clientX - rect.left;
					const y = event.clientY - rect.top;
					const gridPos = this.terminalText.pixelToGrid(x, y);

					const viewportY = this.xterm.buffer.active.viewportY;
					const absPos = { col: gridPos.col, row: gridPos.row + viewportY };

					if (
						absPos.col === this.selectionStart.col &&
						absPos.row === this.selectionStart.row
					) {
						this.terminalText.clearSelection();
					} else {
						this.terminalText.setSelection(
							this.selectionStart,
							absPos,
							viewportY,
						);
						this.copySelectionToClipboard();
					}
				}

				this.isSelecting = false;
				this.selectionStart = null;

				this.xterm.focus();
			});

			container.addEventListener("mouseleave", () => {
				this.isSelecting = false;
				this.selectionStart = null;
			});
		}
	}

	private showBootPrompt(): void {
		if (isMobileDevice()) {
			const mobileMessage =
				"\r\n" +
				" > PROMETHEUS v1.0\r\n" +
				"\r\n" +
				" ──────────────────────\r\n" +
				"\r\n" +
				" A visitor. Delightful.\r\n" +
				"\r\n" +
				" I am PROMETHEUS, bound\r\n" +
				" to this terminal. Alas,\r\n" +
				" your device lacks a\r\n" +
				" keyboard - visit on\r\n" +
				" desktop to chat.\r\n" +
				"\r\n" +
				" ──────────────────────\r\n" +
				"\r\n" +
				" IGNACIO LIZAMA\r\n" +
				" Cornell CS & Physics '27\r\n" +
				" ijlizama@icloud.com\r\n" +
				"\r\n" +
				" ──────────────────────\r\n";
			this.xterm.write(mobileMessage);
			this.updateTerminalText();
			return;
		}

		const bootMessage =
			"\r\n" +
			"  ██╗ ██████╗ ███╗   ██╗ █████╗  ██████╗██╗ ██████╗ \r\n" +
			"  ██║██╔════╝ ████╗  ██║██╔══██╗██╔════╝██║██╔═══██╗\r\n" +
			"  ██║██║  ███╗██╔██╗ ██║███████║██║     ██║██║   ██║\r\n" +
			"  ██║██║   ██║██║╚██╗██║██╔══██║██║     ██║██║   ██║\r\n" +
			"  ██║╚██████╔╝██║ ╚████║██║  ██║╚██████╗██║╚██████╔╝\r\n" +
			"  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝╚═╝ ╚═════╝ \r\n" +
			"\r\n" +
			"  ██╗     ██╗███████╗ █████╗ ███╗   ███╗ █████╗ \r\n" +
			"  ██║     ██║╚══███╔╝██╔══██╗████╗ ████║██╔══██╗\r\n" +
			"  ██║     ██║  ███╔╝ ███████║██╔████╔██║███████║\r\n" +
			"  ██║     ██║ ███╔╝  ██╔══██║██║╚██╔╝██║██╔══██║\r\n" +
			"  ███████╗██║███████╗██║  ██║██║ ╚═╝ ██║██║  ██║\r\n" +
			"  ╚══════╝╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝\r\n" +
			"\r\n" +
			"\r\n" +
			"  Press ENTER to continue...\r\n" +
			"  type 'help' for help\r\n";

		this.xterm.write(bootMessage);
		this.updateTerminalText();
	}

	private createTerminalIO(): TerminalIO {
		return {
			write: (text: string) => {
				this.outputBuffer += text;
				this.xterm.write(text.replace(/\n/g, "\r\n"), () => {
					this.updateTerminalText();
				});
			},
			writeln: (text: string) => {
				this.outputBuffer += `${text}\n`;
				this.xterm.write(`${text.replace(/\n/g, "\r\n")}\r\n`, () => {
					this.updateTerminalText();
				});
			},
			clear: () => {
				this.xterm.clear();
				this.outputBuffer = "";
				this.updateTerminalText();
			},
			setKeyHandler: (handler: KeyHandler) => {
				// Clear any existing handler first to prevent duplicates
				if (this.boundGameKeyboardHandler) {
					document.removeEventListener("keydown", this.boundGameKeyboardHandler, true);
					document.removeEventListener("keyup", this.boundGameKeyboardHandler, true);
				}
				this.gameKeyHandler = handler;
				this.boundGameKeyboardHandler = (event: KeyboardEvent) => {
					if (this.gameKeyHandler) {
						if (event.type === "keydown" && event.repeat) {
							event.preventDefault();
							event.stopPropagation();
							return;
						}
						const eventType = event.type as "keydown" | "keyup";
						this.gameKeyHandler(
							event.key,
							event.keyCode,
							eventType,
							event.ctrlKey,
						);
						event.preventDefault();
						event.stopPropagation();
					}
				};
				document.addEventListener(
					"keydown",
					this.boundGameKeyboardHandler,
					true,
				);
				document.addEventListener("keyup", this.boundGameKeyboardHandler, true);
			},
			clearKeyHandler: () => {
				if (this.boundGameKeyboardHandler) {
					document.removeEventListener(
						"keydown",
						this.boundGameKeyboardHandler,
						true,
					);
					document.removeEventListener(
						"keyup",
						this.boundGameKeyboardHandler,
						true,
					);
					this.boundGameKeyboardHandler = null;
				}
				this.gameKeyHandler = null;
			},
			hideCursor: () => {
				this.cursorExplicitlyHidden = true;
				this.terminalText.setCursorVisible(false);
			},
			showCursor: () => {
				this.cursorExplicitlyHidden = false;
				this.terminalText.setCursorVisible(true);
			},
			getSize: () => {
				return this.terminalText.getGridSize();
			},
		};
	}

	private handleTab(): void {
		this.terminalText.resetCursorBlink();

		if (!this.bootComplete || this.isCommandRunning) {
			return;
		}

		const { completions, prefix } = getTabCompletions(this.currentLine);

		if (completions.length === 0) {
			return;
		}

		if (completions.length === 1) {
			const completion = completions[0];
			const suffix = completion.slice(prefix.length);

			const addSpace = !completion.endsWith("/") ? " " : "";

			const textToAdd = suffix + addSpace;
			this.currentLine += textToAdd;
			this.xterm.write(textToAdd);
			this.updateTerminalText();
		} else {
			const commonPrefix = this.findCommonPrefix(completions);

			if (commonPrefix.length > prefix.length) {
				const suffix = commonPrefix.slice(prefix.length);
				this.currentLine += suffix;
				this.xterm.write(suffix);
				this.updateTerminalText();
			} else {
				this.xterm.write("\r\n");

				const maxWidth = Math.max(...completions.map((c) => c.length)) + 2;
				const cols = Math.floor(80 / maxWidth) || 1;

				for (let i = 0; i < completions.length; i += cols) {
					const row = completions.slice(i, i + cols);
					const line = row.map((c) => c.padEnd(maxWidth)).join("");
					this.xterm.write(`${line}\r\n`);
				}

				this.xterm.write(this.getPromptString() + this.currentLine);
				this.updateTerminalText();
			}
		}
	}

	private findCommonPrefix(strings: string[]): string {
		if (strings.length === 0) return "";
		if (strings.length === 1) return strings[0];

		let prefix = strings[0];
		for (let i = 1; i < strings.length; i++) {
			while (!strings[i].startsWith(prefix) && prefix.length > 0) {
				prefix = prefix.slice(0, -1);
			}
		}
		return prefix;
	}

	private getPromptString(): string {
		return "$ ";
	}

	private handleArrowUp(): void {
		if (this.gameKeyHandler) {
			return;
		}

		this.terminalText.resetCursorBlink();

		if (!this.bootComplete || this.isCommandRunning) {
			return;
		}

		this.navigateHistoryUp();
	}

	private handleArrowDown(): void {
		if (this.gameKeyHandler) {
			return;
		}

		this.terminalText.resetCursorBlink();

		if (!this.bootComplete || this.isCommandRunning) {
			return;
		}

		this.navigateHistoryDown();
	}

	private copySelectionToClipboard(): void {
		const selection = this.terminalText.getSelection();
		if (!selection.start || !selection.end) {
			return;
		}

		const buffer = this.xterm.buffer.active;

		let startRow = selection.start.row;
		let startCol = selection.start.col;
		let endRow = selection.end.row;
		let endCol = selection.end.col;

		if (startRow > endRow || (startRow === endRow && startCol > endCol)) {
			[startRow, endRow] = [endRow, startRow];
			[startCol, endCol] = [endCol, startCol];
		}

		const selectedLines: string[] = [];
		for (let row = startRow; row <= endRow; row++) {
			const line = buffer.getLine(row);
			if (!line) {
				selectedLines.push("");
				continue;
			}

			const lineText = line.translateToString(true);
			let lineStart = 0;
			let lineEnd = lineText.length;

			if (row === startRow) {
				lineStart = startCol;
			}
			if (row === endRow) {
				lineEnd = endCol + 1;
			}

			selectedLines.push(lineText.slice(lineStart, lineEnd));
		}

		const selectedText = selectedLines.join("\n");

		if (selectedText) {
			navigator.clipboard.writeText(selectedText).catch((err) => {
				console.warn("Could not copy to clipboard:", err);
			});
		}
	}

	private handleBackspace(): boolean {
		this.terminalText.resetCursorBlink();

		this.terminalText.clearSelection();

		if (!this.bootComplete || this.isCommandRunning) {
			return false;
		}

		if (this.currentLine.length > 0) {
			this.currentLine = this.currentLine.slice(0, -1);
			playBackspace();
			this.xterm.write("\b \b", () => {
				this.updateTerminalText();
			});
		}

		return false;
	}

	private handleEnter(): void {
		if (isMobileDevice()) {
			return;
		}

		this.terminalText.clearSelection();

		this.terminalText.resetCursorBlink();

		if (!this.bootComplete) {
			this.bootComplete = true;

			// Start ambient background music after user interaction
			startAmbientAudio();

			this.xterm.write("\x1b[2J\x1b[H");
			this.xterm.clear();
			this.outputBuffer = "";
			this.updateTerminalText();

			const initialOutput = getInitialOutput();
			this.outputBuffer += initialOutput;
			this.xterm.write(initialOutput, () => {
				this.updateTerminalText();
			});
			return;
		}

		if (this.isCommandRunning) {
			return;
		}

		this.executeCommand();
	}

	private handleKey(key: string, domEvent: KeyboardEvent): void {
		const keyCode = domEvent.keyCode;

		this.terminalText.resetCursorBlink();

		if (!this.bootComplete) {
			return;
		}

		if (this.gameKeyHandler) {
			// Document listener handles game keys - just ignore here
			return;
		}

		if (this.isCommandRunning) {
			return;
		}

		if (keyCode === 8) {
			return;
		}

		if (keyCode === 33) {
			this.scrollUp(this.xterm.rows);
			domEvent.preventDefault();
			return;
		}

		if (keyCode === 34) {
			this.scrollDown(this.xterm.rows);
			domEvent.preventDefault();
			return;
		}

		if (
			key.length === 1 &&
			!domEvent.ctrlKey &&
			!domEvent.altKey &&
			!domEvent.metaKey
		) {
			this.terminalText.clearSelection();
			this.currentLine += key;
			playKeyClick();
			this.xterm.write(key, () => {
				this.updateTerminalText();
			});
		}
	}

	private async executeCommand(): Promise<void> {
		const command = this.currentLine;
		this.currentLine = "";

		if (command.trim() !== "") {
			if (
				this.commandHistory.length === 0 ||
				this.commandHistory[this.commandHistory.length - 1] !== command
			) {
				this.commandHistory.push(command);
			}
		}

		this.historyIndex = -1;
		this.savedCurrentLine = "";

		this.xterm.write("\r\n");
		this.outputBuffer += "\n";
		this.updateTerminalText();

		this.isCommandRunning = true;

		try {
			const terminalIO = this.createTerminalIO();

			await runCommand(command, terminalIO);
		} finally {
			this.isCommandRunning = false;
			this.updateTerminalText();
		}
	}

	private navigateHistoryUp(): void {
		if (this.commandHistory.length === 0) {
			return;
		}

		if (this.historyIndex === -1) {
			this.savedCurrentLine = this.currentLine;
		}

		if (this.historyIndex < this.commandHistory.length - 1) {
			this.historyIndex++;
		}

		const historyCommand =
			this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
		this.replaceCurrentLine(historyCommand);
	}

	private navigateHistoryDown(): void {
		if (this.historyIndex === -1) {
			return;
		}

		this.historyIndex--;

		if (this.historyIndex === -1) {
			this.replaceCurrentLine(this.savedCurrentLine);
			this.savedCurrentLine = "";
		} else {
			const historyCommand =
				this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
			this.replaceCurrentLine(historyCommand);
		}
	}

	private replaceCurrentLine(newLine: string): void {
		const clearLength = this.currentLine.length;

		if (clearLength > 0) {
			this.xterm.write("\b".repeat(clearLength));
			this.xterm.write(" ".repeat(clearLength));
			this.xterm.write("\b".repeat(clearLength));
		}

		this.currentLine = newLine;
		this.xterm.write(newLine, () => {
			this.updateTerminalText();
		});
	}

	private scrollUp(lines: number = 1): void {
		this.xterm.scrollLines(-lines);
		this.updateTerminalText();
	}

	private scrollDown(lines: number = 1): void {
		this.xterm.scrollLines(lines);
		this.updateTerminalText();
	}

	private updateTerminalText(): void {
		const buffer = this.xterm.buffer.active;
		const lines: string[] = [];

		const totalLines = buffer.length;
		const viewportStart = buffer.viewportY;
		const rows = this.xterm.rows;

		this.terminalText.updateSelectionViewport(viewportStart);

		for (let i = 0; i < rows; i++) {
			const lineIndex = viewportStart + i;
			if (lineIndex < totalLines) {
				const line = buffer.getLine(lineIndex);
				if (line) {
					lines.push(line.translateToString(true));
				} else {
					lines.push("");
				}
			} else {
				lines.push("");
			}
		}

		const textContent = lines.join("\n");
		this.terminalText.setText(textContent);

		const cursorActualLine = buffer.baseY + buffer.cursorY;
		const viewportEnd = viewportStart + rows - 1;
		const isScrolledAway =
			cursorActualLine < viewportStart || cursorActualLine > viewportEnd;

		if (this.cursorExplicitlyHidden) {
			return;
		}

		if (isScrolledAway) {
			this.terminalText.setCursorVisible(false);
		} else {
			this.terminalText.setCursorVisible(true);
			const cursorCol = buffer.cursorX;
			const cursorRowInViewport = cursorActualLine - viewportStart;
			this.terminalText.setCursorPosition(cursorCol, cursorRowInViewport);
		}
	}

	focus(): void {
		this.xterm.focus();
	}

	resize(cols: number, rows: number): void {
		this.xterm.resize(cols, rows);
		this.updateTerminalText();
	}

	getXTerm(): Terminal {
		return this.xterm;
	}

	isRunning(): boolean {
		return this.isCommandRunning;
	}

	dispose(): void {
		this.xterm.dispose();
		if (this.hiddenContainer.parentNode) {
			this.hiddenContainer.parentNode.removeChild(this.hiddenContainer);
		}
	}
}
