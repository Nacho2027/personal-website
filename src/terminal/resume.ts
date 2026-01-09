/**
 * Resume - ASCII resume display with PDF download option
 */

import type { TerminalIO, KeyHandler } from "./ShellEmulator";

const RESUME_ASCII = `
================================================================================
                              IGNACIO J. LIZAMA
================================================================================

    Email: ijlizama@icloud.com                          Phone: 305.202.1341
    LinkedIn: https://www.linkedin.com/in/ignacio-lizama-352112240/
    GitHub: https://github.com/Nacho2027
    Website: https://ignaciolizama.com

--------------------------------------------------------------------------------
                                  EDUCATION
--------------------------------------------------------------------------------

CORNELL UNIVERSITY                                              Ithaca, NY
B.S. Computer Science & Applied Physics (Double Major)     Expected May 2027

Relevant Coursework:
  Object-Oriented Programming & Data Structures, Functional Programming,
  Discrete Math, Linear Algebra, Probability & Statistics, Differential
  Equations, Electronic Circuits, Intro Quantum Mechanics, Mechanics of
  Particles & Solid Bodies, Intermediate Mathematical Physics

--------------------------------------------------------------------------------
                                  EXPERIENCE
--------------------------------------------------------------------------------

JULI AI LLC                                                      Miami, FL
CEO & Co-Founder                                         May 2025 - Present

  * Architected Juli's agentic marketplace by pairing NetworkX-based Graph
    of Thoughts planning with MCP-Zero routing to orchestrate 300+ tools,
    earning a top-9% finish in Y Combinator's Fall 2025 batch with direct
    encouragement from partners to reapply.

  * Directed a 2-engineer pod while shipping 60% of production code,
    implementing a stateful LLM execution pipeline that minimized redundant
    context serialization to reduce token overhead by 30% and Temporal
    workflows for asynchronous fault tolerance.

  * Open-sourced Juli-Calendar and Juli-Email agents to demonstrate Model
    Context Protocol (MCP) integration patterns, accelerating developer
    adoption of the orchestration-first architecture.

..............................................................................

CORNELL UNIVERSITY - EARTH & ATMOSPHERIC SCIENCES DEPT.          Ithaca, NY
Research Assistant, Mahowald Lab                         Jan 2025 - May 2025

  * Designed and trained a ConvLSTM neural network in PyTorch to forecast
    global Aerosol Optical Depth (AOD), modeling complex spatiotemporal
    atmospheric dynamics across multi-year satellite observations under the
    supervision of Professor Natalie Mahowald.

  * Architected a scalable ETL pipeline for MERRA-2 reanalysis satellite
    data using Xarray, Dask, and Zarr, with automated ingestion from NASA
    Earthdata APIs to handle authentication, rate limiting, retries, and
    parallel chunk downloads.

  * Automated hyperparameter optimization using Optuna to minimize RMSE
    loss and improve forecast accuracy on geospatial datasets.

..............................................................................

CORNELL MARS ROVER                                               Ithaca, NY
Software Engineer                                        Aug 2023 - May 2025

  * Implemented obstacle detection using ZED stereo camera point clouds and
    surface normal analysis in the ZED SDK, boosting autonomous path-finding
    efficiency by 25% in University Rover Challenge field simulations
    competing against 36 international teams.

  * Developed costmap generation and finite state machine logic in ROS2 to
    coordinate autonomous navigation behaviors.

..............................................................................

LULA (now GAIL)                                                   Miami, FL
Software Engineering Intern (Summers 2023 & 2024)        May 2023 - Aug 2024

  * Built a FastAPI call-intelligence platform on Google Cloud Platform
    (Cloud Run + Cloud SQL) with ElevenLabs voice synthesis, DeepGram
    sentiment analysis, and Honeycomb tracing to surface post-call metrics
    while trimming backend costs by 10%.

  * Led SQL and BigQuery analytics tying call visibility metrics to client
    KPIs, producing data-driven insights that directly secured GAIL's first
    enterprise banking contract and contributed to the company's successful
    $8.2M seed funding round.

  * Shipped a RAG-based document QA service using OpenAI and vector search,
    cutting security questionnaire time by 4 hours weekly.

--------------------------------------------------------------------------------
                                   PROJECTS
--------------------------------------------------------------------------------

FOURIER FORECAST NEWSLETTER                                  Aug - Oct 2025

  * Created an AI-powered daily newsletter inspired by Fourier analysis,
    transforming internet content into intellectual "signal" using a
    multi-stage Python pipeline with Gemini 2.5-Flash, Voyage AI embeddings,
    and Exa Websets discovery.

  * Designed a 7-axis content ranking system and 4-layer semantic
    deduplication framework filtering 80+ sources daily.

..............................................................................

PRECISION MEASUREMENT OF EDDY CURRENT BRAKING                Mar - May 2025

  * Designed a custom optical encoder circuit (LED photodiode, BJT
    amplification, Schmitt trigger) for RPM measurements.

  * Collected and analyzed velocity-time data in Python/Arduino to model
    eddy current braking forces using exponential decay fits, systematically
    deriving and validating material resistivity of an aluminum disk against
    theoretical predictions.

  * Achieved R^2 = 0.98 correlation between theoretical model and
    experimental data, accounting for frictional forces.

--------------------------------------------------------------------------------
                           TECHNICAL SKILLS & INTERESTS
--------------------------------------------------------------------------------

Languages:    Python, Java, SQL, OCaml

Frameworks    NumPy/Pandas, FastAPI, Flask, Docker, AWS, Google Cloud,
& Tools:      Redis, Auth0, WebSockets, Git

Concepts:     Backend Engineering, Full-Stack Application Design,
              Agentic Systems, Data Analysis

Interests:    Golf, Autonomous Robotics, Tutoring (Algebra II, Calculus),
              Human-Centered AI Applications, Science Fiction, Catan

================================================================================
`;

/**
 * Download the PDF resume
 */
function downloadResume(): void {
  const link = document.createElement("a");
  link.href = "/assets/content/resume.pdf";
  link.download = "Ignacio_Lizama_Resume.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Display the resume with interactive scrolling
 */
export function runResume(terminal: TerminalIO): Promise<void> {
	return new Promise((resolve) => {
		const lines = RESUME_ASCII.split("\n");
		const size = terminal.getSize?.() || { cols: 80, rows: 24 };
		const viewportHeight = size.rows - 3; // Leave room for status bar
		let scrollPos = 0;
		const maxScroll = Math.max(0, lines.length - viewportHeight);

		const drawResume = () => {
			terminal.write("\x1b[2J\x1b[H");
			terminal.clear();

			// Draw visible portion of resume
			for (let i = 0; i < viewportHeight; i++) {
				const lineIndex = scrollPos + i;
				if (lineIndex < lines.length) {
					terminal.writeln(lines[lineIndex]);
				} else {
					terminal.writeln("");
				}
			}

			// Status bar
			const progress = maxScroll > 0 ? Math.round((scrollPos / maxScroll) * 100) : 100;
			const statusLeft = `  [D] Download PDF  [ESC] Exit  [↑↓] Scroll`;
			const statusRight = `${progress}%`;
			const padding = " ".repeat(Math.max(0, size.cols - statusLeft.length - statusRight.length - 2));
			terminal.writeln("");
			terminal.write(statusLeft + padding + statusRight);
		};

		// Key handler
		const handleKey: KeyHandler = (key, _keyCode, eventType) => {
			if (eventType !== "keydown") return;

			if (key === "Escape") {
				terminal.clearKeyHandler?.();
				terminal.showCursor?.();
				terminal.write("\x1b[2J\x1b[H");
				terminal.clear();
				resolve();
				return;
			}

			if (key.toLowerCase() === "d") {
				downloadResume();
			}

			// Scroll controls
			if (key === "ArrowUp" || key === "k") {
				if (scrollPos > 0) {
					scrollPos--;
					drawResume();
				}
			} else if (key === "ArrowDown" || key === "j") {
				if (scrollPos < maxScroll) {
					scrollPos++;
					drawResume();
				}
			} else if (key === "PageUp") {
				scrollPos = Math.max(0, scrollPos - viewportHeight);
				drawResume();
			} else if (key === "PageDown") {
				scrollPos = Math.min(maxScroll, scrollPos + viewportHeight);
				drawResume();
			} else if (key === "Home") {
				scrollPos = 0;
				drawResume();
			} else if (key === "End") {
				scrollPos = maxScroll;
				drawResume();
			}
		};

		terminal.hideCursor?.();
		terminal.setKeyHandler?.(handleKey);
		drawResume(); // Initial draw at top
	});
}
