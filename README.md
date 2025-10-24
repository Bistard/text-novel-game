# Introduction

Single-player narrative prototype for the DAC-204 Narrative Game assignment. The app parses a lightweight plaintext script and renders an interactive story with inventory, stat growth, and randomised outcomes.

## Getting Started
- Open `index.html` in a modern browser or serve the project with any static file server.
- The engine loads `assets/story.txt`, parses every branch, and presents the story using the HTML UI in `index.html`.
- Use the **Restart** button to jump back to the opening branch at any point.

## Project Structure
- `index.html` — Layout and UI hooks.
- `css/styles.css` — Styling for the story view, choices, and panels.
- `js/storyParser.js` — Converts the plaintext format into structured branch data.
- `js/storyEngine.js` — Manages player state, applies effects, and renders the UI.
- `js/main.js` — Boots the engine and wires up controls.
- `assets/story.txt` — Example story demonstrating inventory, stats, and randomised branches.

When authoring new stories, duplicate or edit `assets/story.txt`, ensuring every branch follows the format above. The parser is whitespace-friendly and ignores blank lines, so feel free to space sections for readability.
