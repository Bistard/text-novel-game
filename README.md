# Echoes of Aravon

Single-player narrative game built for the DAC-204 Single-Player Narrative Game Group Assignment. The experience runs entirely in the browser and consumes a plaintext story file, making it easy to iterate on narrative content without touching the code.

## Getting Started
- Serve the repository directory with any static web server (for example `npx serve .` or VS Code Live Server) to avoid browser restrictions on `fetch` from the file system, then open `index.html`.
- The engine fetches `assets/story.txt`, parses the narrative nodes, and presents the interactive story with stat tracking, inventory management, and randomised/test-based outcomes.
- Use the **Restart** button in the header to jump back to the beginning at any time.

## Story Authoring Format
Story content lives in `assets/story.txt` and follows a lightweight section-based markup:

```
::nodeId
title: Optional Title
text:
Narrative paragraph one.
Narrative paragraph two.
/text
choices:
- Choice text -> targetNode | adjust=resolve:+1 | requires=insight>=5
- Another choice -> differentNode | chance=d6>=4?successNode:failureNode
/choices
```

Key features:
- `::meta` section defines `start` node, initial `stats`, `inventory`, and optional description.
- `entry:` blocks allow automatic stat/inventory/log effects when entering a node.
- `adjust=` modifies stats; `item=add:Item` or `item=remove:Item` manages inventory.
- `requires=` enforces stat or item requirements before a choice can be taken.
- `test=` or `chance=` performs stat+dice or dice-only checks to branch on success/failure.
- `ending:` tags on nodes without choices mark narrative conclusions for display.

## Project Structure
- `index.html` — Main layout and UI elements.
- `css/styles.css` — Visual novel-inspired presentation and responsive layout rules.
- `js/storyParser.js` — Converts the plaintext story format into structured data.
- `js/storyEngine.js` — Handles state, stat updates, tests, and rendering.
- `js/main.js` — Boots the engine and wires UI controls.
- `assets/story.txt` — Narrative content; roughly 30+ nodes with multiple endings.

To author new stories, duplicate `assets/story.txt`, adjust the meta section, and update individual nodes as needed. The parser is forgiving about whitespace and comments (prefix lines with `#`), making collaborative editing straightforward.
