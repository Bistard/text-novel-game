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
	save: document.getElementById("save-button"),
	home: document.getElementById("home-button"),
	systemMessages: document.getElementById("system-messages"),
	skipButton: document.getElementById("skip-button"),
};

const homeScreen = document.getElementById("home-screen");
const homeStart = document.getElementById("home-start");
const homeLoad = document.getElementById("home-load");
const homeNote = document.getElementById("home-note");
const appContainer = document.getElementById("app");

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

let gameVisible = false;
let loadingGame = false;
let hasLoadedStory = false;

function revealGame() {
	if (homeScreen) {
		homeScreen.hidden = true;
	}
	if (appContainer) {
		appContainer.hidden = false;
	}
	gameVisible = true;
}

function setHomeMessage(message) {
	if (homeNote) {
		homeNote.textContent = message || "";
	}
}

function resetHomeState() {
	if (homeStart) {
		homeStart.disabled = false;
		homeStart.textContent = "Start Game";
	}
	setHomeMessage("");
}

function returnHome() {
	if (appContainer) {
		appContainer.hidden = true;
	}
	if (homeScreen) {
		homeScreen.hidden = false;
	}
	gameVisible = false;
	resetHomeState();
}

async function startGame() {
	if (loadingGame) return;
	loadingGame = true;
	const originalLabel = homeStart ? homeStart.textContent : "";
	setHomeMessage("");
	if (homeStart) {
		homeStart.disabled = true;
		homeStart.textContent = "Loading...";
	}

	try {
		if (!hasLoadedStory) {
			await engine.load("assets/story.txt");
			hasLoadedStory = true;
		} else {
			engine.restart();
		}
		revealGame();
	} catch (error) {
		console.error(error);
		setHomeMessage("Failed to start the story. Please check the game files and try again.");
		showFatalError(
			"Unable to load story file. Please ensure assets/story.txt exists and is well formatted."
		);
	} finally {
		if (!gameVisible && homeStart) {
			homeStart.disabled = false;
			homeStart.textContent = originalLabel || "Start Game";
		}
		loadingGame = false;
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

if (homeStart) {
	homeStart.addEventListener("click", () => {
		if (gameVisible) {
			revealGame();
			return;
		}
		startGame();
	});
}

if (homeLoad) {
	homeLoad.addEventListener("click", () => {
		setHomeMessage("Load Game is coming soon.");
		console.info("Load Game feature is not implemented yet.");
	});
}

if (elements.home) {
	elements.home.addEventListener("click", () => {
		returnHome();
	});
}

if (elements.save) {
	elements.save.addEventListener("click", () => {
		console.info("Save Game feature is not implemented yet.");
	});
}
