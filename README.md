# Introduction

Single-player narrative prototype for the DAC-204 Narrative Game assignment. The app parses a lightweight plaintext script and renders an interactive story with inventory, stat growth, and randomised outcomes.

## Getting Started
- Open `index.html` in a modern browser or serve the project with any static file server.
- The engine loads `assets/story.txt`, parses every branch, and presents the story using the HTML UI in `index.html`.
- Allowed stats and their starting values are listed in `assets/stats.config` using `name = value` lines.
- Use the **Restart** button to jump back to the opening branch at any point.
- Save progress from the in-game header and load it later from the home screen's **Load Game** button.
