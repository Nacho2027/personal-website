/**
 * Piano - An interactive ASCII piano easter egg
 * Uses Web Audio API for real-time synthesis
 */

import type { TerminalIO, KeyHandler } from "./ShellEmulator";
import { addPianoSessionToHistory } from "./ShellEmulator";

// Note frequencies (Hz) - maps to keys: a s d f g h j k l ; '
const NOTE_MAP: { [key: string]: { note: string; freq: number } } = {
	a: { note: "C4", freq: 261.63 },
	s: { note: "D4", freq: 293.66 },
	d: { note: "E4", freq: 329.63 },
	f: { note: "F4", freq: 349.23 },
	g: { note: "G4", freq: 392.0 },
	h: { note: "A4", freq: 440.0 },
	j: { note: "B4", freq: 493.88 },
	k: { note: "C5", freq: 523.25 },
	l: { note: "D5", freq: 587.33 },
	";": { note: "E5", freq: 659.25 },
	"'": { note: "F5", freq: 698.46 },
};

// Sharp notes (black keys) - mapped to row above
const SHARP_MAP: { [key: string]: { note: string; freq: number } } = {
	w: { note: "C#", freq: 277.18 },
	e: { note: "D#", freq: 311.13 },
	t: { note: "F#", freq: 369.99 },
	y: { note: "G#", freq: 415.3 },
	u: { note: "A#", freq: 466.16 },
	o: { note: "C#", freq: 554.37 },
	p: { note: "D#", freq: 622.25 },
};

// Active oscillators for polyphony
const activeOscillators: Map<string, OscillatorNode> = new Map();

// Audio context singleton
let audioContext: AudioContext | null = null;
let mainGain: GainNode | null = null;

function getAudioContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
		mainGain = audioContext.createGain();
		mainGain.gain.value = 0.3;
		mainGain.connect(audioContext.destination);
	}
	if (audioContext.state === "suspended") {
		audioContext.resume();
	}
	return audioContext;
}

function playNote(key: string): void {
	const noteInfo = NOTE_MAP[key] || SHARP_MAP[key];
	if (!noteInfo || activeOscillators.has(key)) return;

	const ctx = getAudioContext();

	// Create oscillator with piano-like characteristics
	const osc = ctx.createOscillator();
	osc.type = "triangle"; // Warmer than sine, less harsh than sawtooth

	// Create envelope for smoother attack/release
	const envelope = ctx.createGain();
	envelope.gain.setValueAtTime(0, ctx.currentTime);
	envelope.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01); // Quick attack

	osc.frequency.value = noteInfo.freq;
	osc.connect(envelope);
	envelope.connect(mainGain!);

	osc.start();
	activeOscillators.set(key, osc);
}

function stopNote(key: string): void {
	const osc = activeOscillators.get(key);
	if (!osc) return;

	const ctx = getAudioContext();

	// Quick release to avoid clicks
	const envelope = ctx.createGain();
	envelope.gain.setValueAtTime(0.4, ctx.currentTime);
	envelope.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

	osc.disconnect();
	osc.connect(envelope);
	envelope.connect(mainGain!);

	setTimeout(() => {
		osc.stop();
		activeOscillators.delete(key);
	}, 150);
}

function stopAllNotes(): void {
	for (const [key] of activeOscillators) {
		stopNote(key);
	}
}

/**
 * Run the interactive piano
 */
export function runPiano(terminal: TerminalIO): Promise<void> {
	return new Promise((resolve) => {
		const activeKeys = new Set<string>();

		const drawPiano = () => {
			terminal.write("\x1b[2J\x1b[H");
			terminal.clear();

			const p = (k: string) => activeKeys.has(k);

			// Black key: 3 chars, fills when pressed
			const bk = (k: string) => p(k) ? "***" : "|||";
			const bkL = (k: string, l: string) => p(k) ? `*${l}*` : `|${l}|`;

			// White key: 4 chars, fills when pressed
			const wk = (k: string) => p(k) ? "****" : "    ";
			const wkL = (k: string, l: string) => p(k) ? `*${l}* ` : ` ${l}  `;

			terminal.writeln("");

			// Black keys - taller block
			terminal.writeln("        ___  ___          ___  ___  ___          ___  ___");
			terminal.writeln(`       |${bk("w")}||${bk("e")}|        |${bk("t")}||${bk("y")}||${bk("u")}|        |${bk("o")}||${bk("p")}|`);
			terminal.writeln(`       |${bkL("w", "w")}||${bkL("e", "e")}|        |${bkL("t", "t")}||${bkL("y", "y")}||${bkL("u", "u")}|        |${bkL("o", "o")}||${bkL("p", "p")}|`);
			terminal.writeln("       |___||___|        |___||___||___|        |___||___|");

			// White keys - taller block
			terminal.writeln("    ______________________________________________________");
			terminal.writeln(`   |${wk("a")}|${wk("s")}|${wk("d")}|${wk("f")}|${wk("g")}|${wk("h")}|${wk("j")}|${wk("k")}|${wk("l")}|${wk(";")}|${wk("'")}|`);
			terminal.writeln(`   |${wk("a")}|${wk("s")}|${wk("d")}|${wk("f")}|${wk("g")}|${wk("h")}|${wk("j")}|${wk("k")}|${wk("l")}|${wk(";")}|${wk("'")}|`);
			terminal.writeln(`   |${wkL("a", "a")}|${wkL("s", "s")}|${wkL("d", "d")}|${wkL("f", "f")}|${wkL("g", "g")}|${wkL("h", "h")}|${wkL("j", "j")}|${wkL("k", "k")}|${wkL("l", "l")}|${wkL(";", ";")}|${wkL("'", "'")}|`);
			terminal.writeln("   |____|____|____|____|____|____|____|____|____|____|____|");

			terminal.writeln("      C    D    E    F    G    A    B    C    D    E    F");

			terminal.writeln("");

			if (activeKeys.size > 0) {
				const notes = Array.from(activeKeys)
					.map((k) => NOTE_MAP[k]?.note || SHARP_MAP[k]?.note)
					.filter(Boolean);
				terminal.writeln(`   Now playing: ${notes.join(" + ")}`);
			} else {
				terminal.writeln("   ESC to exit");
			}
		};

		// Key handler
		const handleKey: KeyHandler = (key, _keyCode, eventType) => {
			if (eventType === "keydown") {
				if (key === "Escape") {
					stopAllNotes();
					terminal.clearKeyHandler?.();
					terminal.showCursor?.();
					terminal.write("\x1b[2J\x1b[H");
					terminal.clear();
					terminal.writeln(" Thanks for playing!");
					terminal.writeln("");
					addPianoSessionToHistory();
					resolve();
					return;
				}

				const lowerKey = key.toLowerCase();
				// Handle semicolon and quote directly
				const actualKey = key === ";" ? ";" : key === "'" ? "'" : lowerKey;

				if ((NOTE_MAP[actualKey] || SHARP_MAP[actualKey]) && !activeKeys.has(actualKey)) {
					activeKeys.add(actualKey);
					playNote(actualKey);
					drawPiano();
				}
			} else if (eventType === "keyup") {
				const lowerKey = key.toLowerCase();
				const actualKey = key === ";" ? ";" : key === "'" ? "'" : lowerKey;

				if (activeKeys.has(actualKey)) {
					activeKeys.delete(actualKey);
					stopNote(actualKey);
					drawPiano();
				}
			}
		};

		// Initialize
		terminal.hideCursor?.();
		terminal.setKeyHandler?.(handleKey);
		drawPiano();
	});
}
