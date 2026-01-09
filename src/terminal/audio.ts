/**
 * Audio module - Real mechanical keyboard sounds for terminal
 * Uses actual MX Blue switch samples for authentic clicky feel
 * Includes ambient background audio for atmosphere
 */

let audioContext: AudioContext | null = null;

// Preloaded audio buffers
let keyBuffers: AudioBuffer[] = [];
let backspaceBuffer: AudioBuffer | null = null;
let ambientBuffer: AudioBuffer | null = null;
let isLoaded = false;

// Ambient audio state
let ambientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;
let isAmbientPlaying = false;

function getAudioContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

/**
 * Preload all audio samples
 * Call this early to avoid delays on first keypress
 */
export async function initAudio(): Promise<void> {
	if (isLoaded) return;

	const ctx = getAudioContext();

	const keyFiles = [
		"/assets/audio/press_key1.mp3",
		"/assets/audio/press_key2.mp3",
		"/assets/audio/press_key3.mp3",
		"/assets/audio/press_key4.mp3",
		"/assets/audio/press_key5.mp3",
	];

	try {
		// Load key sounds in parallel
		const keyPromises = keyFiles.map(async (file) => {
			const response = await fetch(file);
			const arrayBuffer = await response.arrayBuffer();
			return ctx.decodeAudioData(arrayBuffer);
		});

		keyBuffers = await Promise.all(keyPromises);

		// Load backspace sound
		const backspaceResponse = await fetch("/assets/audio/delete.wav");
		const backspaceArrayBuffer = await backspaceResponse.arrayBuffer();
		backspaceBuffer = await ctx.decodeAudioData(backspaceArrayBuffer);

		// Load ambient background music
		const ambientResponse = await fetch("/assets/audio/background.mp3");
		const ambientArrayBuffer = await ambientResponse.arrayBuffer();
		ambientBuffer = await ctx.decodeAudioData(ambientArrayBuffer);

		isLoaded = true;
	} catch (error) {
		console.warn("Failed to load audio samples:", error);
	}
}

/**
 * Play a random MX Blue key click sound
 */
export function playKeyClick(): void {
	const ctx = getAudioContext();
	if (ctx.state === "suspended") {
		ctx.resume();
	}

	if (keyBuffers.length === 0) {
		// Fallback: try to load and play later
		initAudio();
		return;
	}

	// Pick a random key sound for natural variation
	const buffer = keyBuffers[Math.floor(Math.random() * keyBuffers.length)];

	const source = ctx.createBufferSource();
	source.buffer = buffer;

	// Slight pitch/rate variation for more organic feel
	source.playbackRate.value = 0.95 + Math.random() * 0.1;

	// Volume control
	const gainNode = ctx.createGain();
	gainNode.gain.value = 0.6;

	source.connect(gainNode);
	gainNode.connect(ctx.destination);
	source.start();
}

/**
 * Play backspace/delete sound
 */
export function playBackspace(): void {
	const ctx = getAudioContext();
	if (ctx.state === "suspended") {
		ctx.resume();
	}

	if (!backspaceBuffer) {
		initAudio();
		return;
	}

	const source = ctx.createBufferSource();
	source.buffer = backspaceBuffer;

	// Volume control
	const gainNode = ctx.createGain();
	gainNode.gain.value = 0.5;

	source.connect(gainNode);
	gainNode.connect(ctx.destination);
	source.start();
}

/**
 * Start ambient background music
 * Loops continuously with gentle volume
 */
export function startAmbientAudio(): void {
	if (isAmbientPlaying) return;

	const ctx = getAudioContext();
	if (ctx.state === "suspended") {
		ctx.resume();
	}

	if (!ambientBuffer) {
		// Try to load first, then play
		initAudio().then(() => {
			if (ambientBuffer) startAmbientAudio();
		});
		return;
	}

	// Create source node
	ambientSource = ctx.createBufferSource();
	ambientSource.buffer = ambientBuffer;
	ambientSource.loop = true;

	// Create gain for volume control
	ambientGain = ctx.createGain();
	ambientGain.gain.value = 0.3; // Gentle background level

	ambientSource.connect(ambientGain);
	ambientGain.connect(ctx.destination);
	ambientSource.start();

	isAmbientPlaying = true;
}

/**
 * Stop ambient background music
 */
export function stopAmbientAudio(): void {
	if (!isAmbientPlaying || !ambientSource) return;

	ambientSource.stop();
	ambientSource.disconnect();
	ambientSource = null;
	ambientGain = null;
	isAmbientPlaying = false;
}

/**
 * Play morse code beep for bot typing
 * Different pitch for spaces vs regular characters
 */
export function playBotTypingSound(char: string): void {
	const ctx = getAudioContext();
	if (ctx.state === "suspended") {
		ctx.resume();
	}

	// Skip sound for spaces and newlines (creates rhythm)
	if (char === " " || char === "\n" || char === "\r") {
		return;
	}

	const now = ctx.currentTime;

	// Oscillator for the beep
	const osc = ctx.createOscillator();
	osc.type = "sine";

	// Vary pitch slightly based on character for more organic feel
	const baseFreq = 440; // A4
	const charCode = char.charCodeAt(0);
	const freqVariation = (charCode % 5) * 20; // Small variation
	osc.frequency.value = baseFreq + freqVariation;

	// Short envelope for morse-code feel
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0, now);
	gain.gain.linearRampToValueAtTime(0.15, now + 0.005); // Quick attack
	gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03); // Quick decay

	osc.connect(gain);
	gain.connect(ctx.destination);

	osc.start(now);
	osc.stop(now + 0.03);
}
