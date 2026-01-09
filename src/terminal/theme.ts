/**
 * Theme - Terminal theme switcher inspired by cool-retro-term
 * Allows switching between classic CRT terminal themes
 */

import type { TerminalIO, KeyHandler } from "./ShellEmulator";

/**
 * Theme configuration matching cool-retro-term settings
 */
export interface Theme {
	name: string;
	fontColor: string;
	backgroundColor: string;
	bloom: number;
	brightness: number;
	burnIn: number;
	chromaColor: number;
	contrast: number;
	flickering: number;
	glowingLine: number;
	horizontalSync: number;
	jitter: number;
	rbgShift: number;
	saturationColor: number;
	screenCurvature: number;
	staticNoise: number;
	ambientLight: number;
	rasterization: number;
}

/**
 * All themes from cool-retro-term
 */
export const THEMES: Theme[] = [
	{
		name: "Default Amber",
		fontColor: "#ff8100",
		backgroundColor: "#000000",
		bloom: 0.5538,
		brightness: 0.5,
		burnIn: 0.2517,
		chromaColor: 0.2483,
		contrast: 0.7959,
		flickering: 0.1,
		glowingLine: 0.2,
		horizontalSync: 0.08,
		jitter: 0.1997,
		rbgShift: 0,
		saturationColor: 0.2483,
		screenCurvature: 0.3,
		staticNoise: 0.1198,
		ambientLight: 0.2,
		rasterization: 0,
	},
	{
		name: "Monochrome Green",
		fontColor: "#0ccc68",
		backgroundColor: "#000000",
		bloom: 0.5538,
		brightness: 0.5,
		burnIn: 0.2517,
		chromaColor: 0.0,
		contrast: 0.7959,
		flickering: 0.1,
		glowingLine: 0.2,
		horizontalSync: 0.08,
		jitter: 0.1997,
		rbgShift: 0,
		saturationColor: 0.0,
		screenCurvature: 0.3,
		staticNoise: 0.1198,
		ambientLight: 0.2,
		rasterization: 0,
	},
	{
		name: "Green Scanlines",
		fontColor: "#7cff4f",
		backgroundColor: "#000000",
		bloom: 0.6,
		brightness: 0.5,
		burnIn: 0.3,
		chromaColor: 0.5,
		contrast: 0.6,
		flickering: 0.1,
		glowingLine: 0.2,
		horizontalSync: 0.151,
		jitter: 0.11,
		rbgShift: 0,
		saturationColor: 0.5,
		screenCurvature: 0.3,
		staticNoise: 0.15,
		ambientLight: 0.0,
		rasterization: 1,
	},
	{
		name: "Default Pixelated",
		fontColor: "#ffffff",
		backgroundColor: "#000000",
		bloom: 0.4045,
		brightness: 0.6041,
		burnIn: 0.1024,
		chromaColor: 0.7517,
		contrast: 0.7473,
		flickering: 0.1962,
		glowingLine: 0.2,
		horizontalSync: 0.151,
		jitter: 0,
		rbgShift: 0,
		saturationColor: 0,
		screenCurvature: 0,
		staticNoise: 0.15,
		ambientLight: 0,
		rasterization: 2,
	},
	{
		name: "Apple ][",
		fontColor: "#00d56d",
		backgroundColor: "#000000",
		bloom: 0.5,
		brightness: 0.5,
		burnIn: 0.5017,
		chromaColor: 0,
		contrast: 0.85,
		flickering: 0.2,
		glowingLine: 0.22,
		horizontalSync: 0.16,
		jitter: 0.1,
		rbgShift: 0,
		saturationColor: 0,
		screenCurvature: 0.5,
		staticNoise: 0.099,
		ambientLight: 0.3038,
		rasterization: 1,
	},
	{
		name: "Vintage",
		fontColor: "#00ff3e",
		backgroundColor: "#000000",
		bloom: 0.4983,
		brightness: 0.5014,
		burnIn: 0.4983,
		chromaColor: 0,
		contrast: 0.7473,
		flickering: 0.9,
		glowingLine: 0.3,
		horizontalSync: 0.42,
		jitter: 0.4,
		rbgShift: 0.2969,
		saturationColor: 0,
		screenCurvature: 0.5,
		staticNoise: 0.2969,
		ambientLight: 0.5,
		rasterization: 1,
	},
	{
		name: "IBM DOS",
		fontColor: "#ffffff",
		backgroundColor: "#000000",
		bloom: 0.2969,
		brightness: 0.5,
		burnIn: 0.0469,
		chromaColor: 1,
		contrast: 0.85,
		flickering: 0.0955,
		glowingLine: 0.1545,
		horizontalSync: 0,
		jitter: 0.1545,
		rbgShift: 0.3524,
		saturationColor: 0,
		screenCurvature: 0.4,
		staticNoise: 0.0503,
		ambientLight: 0.151,
		rasterization: 0,
	},
	{
		name: "IBM 3278",
		fontColor: "#0ccc68",
		backgroundColor: "#000000",
		bloom: 0.2969,
		brightness: 0.5,
		burnIn: 0.6,
		chromaColor: 0,
		contrast: 0.85,
		flickering: 0,
		glowingLine: 0,
		horizontalSync: 0,
		jitter: 0,
		rbgShift: 0,
		saturationColor: 0,
		screenCurvature: 0.2,
		staticNoise: 0,
		ambientLight: 0.1,
		rasterization: 0,
	},
	{
		name: "Futuristic",
		fontColor: "#729fcf",
		backgroundColor: "#000000",
		bloom: 0.5017,
		brightness: 0.5014,
		burnIn: 0.0955,
		chromaColor: 1,
		contrast: 0.85,
		flickering: 0.2,
		glowingLine: 0.1476,
		horizontalSync: 0,
		jitter: 0.099,
		rbgShift: 0,
		saturationColor: 0.4983,
		screenCurvature: 0,
		staticNoise: 0.0955,
		ambientLight: 0,
		rasterization: 0,
	},
];

// Global reference to the terminal text renderer
let terminalTextRef: TerminalTextRenderer | null = null;

/**
 * Interface for the methods we need from TerminalText
 */
interface TerminalTextRenderer {
	setFontColor(hex: string): void;
	setBackgroundColor(hex: string): void;
	setScreenCurvature(curvature: number): void;
	setRgbShift(amount: number): void;
	setBloom(intensity: number): void;
	setBrightness(level: number): void;
	setAmbientLight(amount: number): void;
	setChromaColor(amount: number): void;
	setFlickering(amount: number): void;
	setHorizontalSync(amount: number): void;
	setJitter(amount: number): void;
	setStaticNoise(amount: number): void;
	setGlowingLine(amount: number): void;
	setBurnIn(amount: number): void;
	setRasterizationMode(mode: number): void;
}

/**
 * Set the terminal text renderer reference
 */
export function setTerminalTextRef(renderer: TerminalTextRenderer): void {
	terminalTextRef = renderer;
}

/**
 * Current theme index (default is Monochrome Green - matches renderer default)
 */
let currentThemeIndex = 1;

/**
 * Apply a theme to the terminal
 */
export function applyTheme(theme: Theme): void {
	if (!terminalTextRef) {
		console.warn("TerminalText reference not set");
		return;
	}

	terminalTextRef.setFontColor(theme.fontColor);
	terminalTextRef.setBackgroundColor(theme.backgroundColor);
	terminalTextRef.setScreenCurvature(theme.screenCurvature);
	terminalTextRef.setRgbShift(theme.rbgShift);
	terminalTextRef.setBloom(theme.bloom);
	terminalTextRef.setBrightness(theme.brightness);
	terminalTextRef.setAmbientLight(theme.ambientLight);
	terminalTextRef.setChromaColor(theme.chromaColor);
	terminalTextRef.setFlickering(theme.flickering);
	terminalTextRef.setHorizontalSync(theme.horizontalSync);
	terminalTextRef.setJitter(theme.jitter);
	terminalTextRef.setStaticNoise(theme.staticNoise);
	terminalTextRef.setGlowingLine(theme.glowingLine);
	terminalTextRef.setBurnIn(theme.burnIn);
	terminalTextRef.setRasterizationMode(theme.rasterization);
}

/**
 * Get current theme
 */
export function getCurrentTheme(): Theme {
	return THEMES[currentThemeIndex];
}

/**
 * Run the interactive theme selector
 */
export function runThemeSelector(terminal: TerminalIO): Promise<void> {
	return new Promise((resolve) => {
		let selectedIndex = currentThemeIndex;

		const drawThemeSelector = () => {
			terminal.write("\x1b[2J\x1b[H");
			terminal.clear();

			terminal.writeln("");
			terminal.writeln("  ╔════════════════════════════════════════════════════╗");
			terminal.writeln("  ║             TERMINAL THEME SELECTOR                ║");
			terminal.writeln("  ╠════════════════════════════════════════════════════╣");
			terminal.writeln("  ║  Themes from cool-retro-term by Swordfish90        ║");
			terminal.writeln("  ╚════════════════════════════════════════════════════╝");
			terminal.writeln("");

			for (let i = 0; i < THEMES.length; i++) {
				const theme = THEMES[i];
				const isSelected = i === selectedIndex;
				const isCurrent = i === currentThemeIndex;
				const prefix = isSelected ? " ▶ " : "   ";
				const suffix = isCurrent ? " [active]" : "";
				const highlight = isSelected ? "█" : " ";
				terminal.writeln(`${prefix}${highlight} ${theme.name}${suffix}`);
			}

			terminal.writeln("");
			terminal.writeln("  ─────────────────────────────────────────────────────");
			terminal.writeln("  [↑↓] Navigate  [ENTER] Apply  [P] Preview  [ESC] Exit");
			terminal.writeln("  ─────────────────────────────────────────────────────");
		};

		const handleKey: KeyHandler = (key, _keyCode, eventType) => {
			if (eventType !== "keydown") return;

			if (key === "Escape") {
				// Restore current theme if previewing
				applyTheme(THEMES[currentThemeIndex]);
				terminal.clearKeyHandler?.();
				terminal.showCursor?.();
				terminal.write("\x1b[2J\x1b[H");
				terminal.clear();
				terminal.writeln(` Theme: ${THEMES[currentThemeIndex].name}`);
				terminal.writeln("");
				resolve();
				return;
			}

			if (key === "ArrowUp" || key === "k") {
				selectedIndex = (selectedIndex - 1 + THEMES.length) % THEMES.length;
				drawThemeSelector();
			} else if (key === "ArrowDown" || key === "j") {
				selectedIndex = (selectedIndex + 1) % THEMES.length;
				drawThemeSelector();
			} else if (key === "Enter") {
				currentThemeIndex = selectedIndex;
				applyTheme(THEMES[currentThemeIndex]);
				terminal.clearKeyHandler?.();
				terminal.showCursor?.();
				terminal.write("\x1b[2J\x1b[H");
				terminal.clear();
				terminal.writeln(` Theme applied: ${THEMES[currentThemeIndex].name}`);
				terminal.writeln("");
				resolve();
			} else if (key.toLowerCase() === "p") {
				// Preview theme without applying permanently
				applyTheme(THEMES[selectedIndex]);
				drawThemeSelector();
			}
		};

		terminal.hideCursor?.();
		terminal.setKeyHandler?.(handleKey);
		drawThemeSelector();
	});
}
