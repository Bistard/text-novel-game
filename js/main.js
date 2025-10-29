import { StoryEngine } from "./storyEngine.js";

// Cache references to key DOM elements
const elements = {
	title: document.getElementById("game-title"),
	nodeTitle: document.getElementById("node-title"),
	storyText: document.getElementById("story-text"),
	choices: document.getElementById("choices"),
	stats: document.getElementById("stats"),
	journal: document.getElementById("journal"),
	inventory: document.getElementById("inventory"),
	restart: document.getElementById("restart-button"),
	systemMessages: document.getElementById("system-messages"),
	skipButton: document.getElementById("skip-button"),
};

// game engine instance
const engine = new StoryEngine({
	nodeTitle: elements.nodeTitle,
	storyText: elements.storyText,
	choices: elements.choices,
	stats: elements.stats,
	journal: elements.journal,
	inventory: elements.inventory,
	systemMessages: elements.systemMessages,
	titleElement: elements.title,
	skipButton: elements.skipButton,
});

async function boot() {
	try {
		await engine.load("assets/story.txt");
	} catch (error) {
		console.error(error);
		showFatalError(
			"Unable to load story file. Please ensure assets/story.txt exists and is well formatted."
		);
	}
}

function showFatalError(message) {
	if (elements.nodeTitle) {
		elements.nodeTitle.textContent = "Story Load Failed";
	}
	if (elements.storyText) {
		elements.storyText.textContent = message;
	}
	if (elements.choices) {
		elements.choices.innerHTML = "";
	}
}

if (elements.restart) {
	elements.restart.addEventListener("click", () => engine.restart());
}

boot();
