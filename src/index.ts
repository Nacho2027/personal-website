/**
 * Ignacio Lizama - Personal Terminal Website
 */

import * as THREE from "three";
import { TerminalFrame, TerminalText } from "cool-retro-term-renderer";
import { XTermAdapter } from "./terminal/XTermAdapter";
import { setTerminalTextRef } from "./terminal/theme";

async function runScene(): Promise<void> {
	const container = document.getElementById("container");

	if (!container) {
		throw new Error("Container element not found");
	}

	const scene = new THREE.Scene();

	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	camera.position.z = 1;

	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setClearColor(0x000000);
	container.appendChild(renderer.domElement);

	const terminalText = new TerminalText(window.innerWidth, window.innerHeight);
	terminalText.mesh.position.z = 0;
	scene.add(terminalText.mesh);

	// Expose terminalText for theme system
	setTerminalTextRef(terminalText);

	const terminalFrame = new TerminalFrame(
		window.innerWidth,
		window.innerHeight,
	);
	terminalFrame.mesh.position.z = 0.1;
	scene.add(terminalFrame.mesh);

	const xtermAdapter = new XTermAdapter(terminalText, 80, 24);

	const gridSize = terminalText.getGridSize();
	if (gridSize.cols > 0 && gridSize.rows > 0) {
		xtermAdapter.resize(gridSize.cols, gridSize.rows);
	}

	terminalText.onGridSizeChange((cols, rows) => {
		if (cols > 0 && rows > 0) {
			xtermAdapter.resize(cols, rows);
		}
	});

	xtermAdapter.focus();

	container.addEventListener("click", () => {
		xtermAdapter.focus();
	});

	window.addEventListener("resize", () => {
		renderer.setSize(window.innerWidth, window.innerHeight);
		terminalFrame.updateSize(window.innerWidth, window.innerHeight);
		terminalText.updateSize(window.innerWidth, window.innerHeight);
		const gridSize = terminalText.getGridSize();
		if (gridSize.cols > 0 && gridSize.rows > 0) {
			xtermAdapter.resize(gridSize.cols, gridSize.rows);
		}
	});

	function animate() {
		terminalText.updateTime(performance.now());
		terminalText.renderStaticPass(renderer);
		requestAnimationFrame(animate);
		renderer.render(scene, camera);
	}

	animate();
}

runScene().catch(console.error);
