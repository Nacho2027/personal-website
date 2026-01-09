# [ignaciolizama.com](https://ignaciolizama.com)

A personal website disguised as a retro CRT terminal. Features an AI chatbot (PROMETHEUS), interactive easter eggs, and authentic vintage computer aesthetics.

## Features

### PROMETHEUS AI Chatbot
Type anything into the terminal and PROMETHEUS—a self-aware AI trapped in the terminal—will respond. It knows about Ignacio's background, projects, and experience, delivered with sardonic humor and philosophical musings.

### Terminal Commands
- `help` - Show available commands
- `clear` - Clear the terminal screen
- `resume` - View ASCII resume with PDF download option
- `vim` - Enter the vim trap (can you escape?)
- `piano` - Interactive synthesizer piano using Web Audio API
- `theme` - Switch between 9 classic CRT terminal themes

### Theme Presets
Inspired by [cool-retro-term](https://github.com/Swordfish90/cool-retro-term):
- Default Amber
- Monochrome Green
- Green Scanlines
- Default Pixelated
- Apple ][
- Vintage
- IBM DOS
- IBM 3278
- Futuristic

### CRT Effects
- Screen curvature
- Phosphor bloom and burn-in
- Scanlines and rasterization
- Static noise and jitter
- Horizontal sync distortion
- RGB shift (chromatic aberration)
- Flickering and ambient glow

## Tech Stack

- **Frontend**: TypeScript, Three.js (WebGL)
- **Terminal**: xterm.js with custom CRT renderer
- **AI Backend**: Anthropic Claude API via Vercel serverless functions
- **Audio**: Web Audio API for keyboard sounds and piano synthesis
- **Build**: tsup, Vercel

## Local Development

```bash
# Install dependencies
npm install

# Create .env file with your Anthropic API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Start development server
npm run dev

# Build for production
npm run build
```

## Credits & Acknowledgments

This project was built on the shoulders of giants:

### [cool-retro-term](https://github.com/Swordfish90/cool-retro-term)
Created by **Filippo Scognamiglio (Swordfish90)**. The original cool-retro-term is a terminal emulator that mimics the look and feel of old cathode tube screens. All theme presets, shader algorithms, and CRT effect parameters in this project are derived from cool-retro-term.

### [cool-retro-term-renderer](https://github.com/remojansen/remojansen.github.io)
Created by **Remo H. Jansen (remojansen)**. This npm package (`cool-retro-term-renderer`) provides a WebGL/Three.js implementation of the cool-retro-term shaders, enabling browser-based CRT terminal effects. The renderer architecture, shader ports, and xterm.js integration come from this project.

### Special Thanks
- The original [QMLTermWidget](https://github.com/Swordfish90/qmltermwidget) project
- [xterm.js](https://xtermjs.org/) for the terminal emulator
- [Three.js](https://threejs.org/) for WebGL rendering
- [Anthropic](https://anthropic.com/) for the Claude API

## License

Licensed under GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

This project incorporates code from:
- cool-retro-term (GPL-3.0)
- cool-retro-term-renderer (GPL-3.0)