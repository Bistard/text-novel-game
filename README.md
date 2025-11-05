# Introduction

Single-player narrative prototype for the DAC-204 Narrative Game assignment. The app parses a lightweight plaintext script and renders an interactive story with inventory, stat growth, and randomised outcomes.

## Getting Started
- Open `index.html` in a modern browser or serve the project with any static file server.
- The engine loads `assets/story.txt`, parses every branch, and presents the story using the HTML UI in `index.html`.
- Allowed stats and their starting values are listed in `assets/stats.config` using `name = value` lines.
- Branch choices can reference the most recent roll result with directives such as `stat=luck+(x)`/`stat=luck+roll` (total), `stat=skill+roll-dice` (dice sum), or `stat=focus-roll-stat` (stat modifier).
- Use the **Restart** button to jump back to the opening branch at any point.
- Save progress from the in-game header and load it later from the home screen's **Load Game** button.

## Conditional Choices

- The engine now tracks every branch the player has visited and preserves that history in save files.
- Choices support `optional` and `valid` directives, each expecting a bracketed condition: `optional=[visited(branch-id)]`.
	- `optional` hides the choice entirely when the condition evaluates to `false`.
	- `valid` keeps the choice visible but disables it until the condition evaluates to `true`.
- Supported condition keywords:
	- `visited(...)` (every listed branch must have been visited) and `visitedAny(...)` (any branch may satisfy the check).
	- `has(...)` (player must hold all listed items) and `hasAny(...)` (player needs at least one of the listed items).
- Branch identifiers and item names are trimmed, so match the IDs and labels used elsewhere in the story file.
