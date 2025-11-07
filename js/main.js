import { StoryEngine } from "./storyEngine.js";
import { saveGameToFile, loadGameFromFile } from "./saveSystem.js";

// Cache references to key DOM elements
const elements = {
	title: document.getElementById("game-title"),
	nodeTitle: document.getElementById("node-title"),
	storyText: document.getElementById("story-text"),
	choices: document.getElementById("choices"),
	undo: document.getElementById("undo-button"),
	stats: document.getElementById("stats"),
	journal: document.getElementById("journal"),
	inventory: document.getElementById("inventory"),
	restart: document.getElementById("restart-button"),
	save: document.getElementById("save-button"),
	load: document.getElementById("load-button"),
	home: document.getElementById("home-button"),
	systemMessages: document.getElementById("system-messages"),
	skipButton: document.getElementById("skip-button"),
	skipToggle: document.getElementById("skip-toggle"),
	graphOverlay: document.getElementById("graph-overlay"),
	graphOpen: document.getElementById("graph-open"),
	graphClose: document.getElementById("graph-close"),
	graphContainer: document.getElementById("story-graph-container"),
	graphToggle: document.getElementById("graph-toggle"),
	graphModeLabel: document.getElementById("graph-mode-label"),
	graphPlaceholder: document.getElementById("graph-placeholder"),
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
	skipToggle: elements.skipToggle,
	graphContainer: elements.graphContainer,
	graphToggle: elements.graphToggle,
	graphModeLabel: elements.graphModeLabel,
	graphPlaceholder: elements.graphPlaceholder,
});

engine.setStateChangeListener(updateUndoButtonState);

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
		homeStart.textContent = "New Game";
	}
	setHomeMessage("");
}

function returnHome() {
	closeGraphOverlay();
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
			homeStart.textContent = originalLabel || "New Game";
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
	elements.restart.addEventListener("click", () => {
		if (engine.choiceInProgress) {
			return;
		}

		const confirmed = window.confirm(
			"Restarting wipes your current progress and takes you back to the beginning. Do you really want to restart?"
		);
		if (!confirmed) {
			return;
		}

		engine.restart();
	});
}

if (elements.undo) {
	elements.undo.addEventListener("click", handleUndoClick);
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
		if (loadingGame) return;
		handleLoadGame({ source: "home" });
	});
}

if (elements.home) {
	elements.home.addEventListener("click", () => {
		const confirmed = window.confirm(
			"Returning home will leave the current story session. Do you want to go back to the home screen?"
		);
		if (!confirmed) {
			return;
		}

		returnHome();
	});
}

if (elements.save) {
	elements.save.addEventListener("click", () => {
		if (loadingGame) return;
		handleSaveClick();
	});
}

if (elements.load) {
	elements.load.addEventListener("click", () => {
		if (loadingGame) return;
		handleLoadGame({ source: "game" });
	});
}

function openGraphOverlay() {
	if (!elements.graphOverlay) return;
	elements.graphOverlay.hidden = false;
	elements.graphOverlay.setAttribute("aria-hidden", "false");
	document.body.classList.add("graph-open");
	if (elements.graphOpen instanceof HTMLElement) {
		elements.graphOpen.setAttribute("aria-expanded", "true");
		elements.graphOpen.setAttribute("aria-pressed", "true");
	}
    if (typeof engine.renderer?.refreshGraphView === "function") {
        // Center the view on the current node when opening
        engine.renderer.refreshGraphView({ focusCurrent: true });
    }
	if (elements.graphOverlay instanceof HTMLElement) {
		elements.graphOverlay.focus();
	}
}

function closeGraphOverlay() {
	if (!elements.graphOverlay || elements.graphOverlay.hidden) return;
	elements.graphOverlay.hidden = true;
	elements.graphOverlay.setAttribute("aria-hidden", "true");
	document.body.classList.remove("graph-open");
	if (elements.graphOpen instanceof HTMLElement) {
		elements.graphOpen.setAttribute("aria-expanded", "false");
		elements.graphOpen.setAttribute("aria-pressed", "false");
		elements.graphOpen.focus();
	}
}

if (elements.graphOpen) {
	elements.graphOpen.addEventListener("click", () => {
		openGraphOverlay();
	});
}

if (elements.graphClose) {
	elements.graphClose.addEventListener("click", () => {
		closeGraphOverlay();
	});
}

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && elements.graphOverlay && !elements.graphOverlay.hidden) {
		event.preventDefault();
		closeGraphOverlay();
	}
});

function updateUndoButtonState(status = {}) {
	const button = elements.undo;
	if (!button) return;

	const canUndo = Boolean(status && status.canUndo);
	const isProcessing = Boolean(status && status.isProcessingChoice);
	const shouldEnable = canUndo && !isProcessing;

	button.disabled = !shouldEnable;
	button.setAttribute("aria-disabled", shouldEnable ? "false" : "true");
}

function handleUndoClick() {
	const button = elements.undo;
	if (!button || button.disabled) {
		return;
	}

	if (!engine.canUndo()) {
		updateUndoButtonState({ canUndo: false, isProcessingChoice: false });
		return;
	}

	const firstPrompt =
		"Every choice carries weight; once a move is made, there's no taking it back. Do you still want to try to undo your last decision?";
	if (!window.confirm(firstPrompt)) {
		return;
	}

	const secondPrompt = "Are you absolutely sure you want to 'undo' your previous move?";
	if (!window.confirm(secondPrompt)) {
		return;
	}

	const undone = engine.undoLastChoice();
	if (!undone) {
		window.alert("There's no choice to undo right now.");
	}
}

async function handleSaveClick() {
	if (!hasLoadedStory) {
		window.alert("A game needs to be running before it can be saved.");
		return;
	}

	let payload;
	try {
		payload = engine.createSavePayload();
	} catch (error) {
		console.error(error);
		window.alert("Unable to capture the current game state for saving.");
		return;
	}

	const result = await saveGameToFile(payload);
	if (result.status === "cancelled") {
		return;
	}
	if (result.status === "error") {
		console.error(result.error);
		window.alert("Saving failed. Please check the console for details.");
		return;
	}

	const name = result.fileName || "the chosen location";
	window.alert(`Game saved to ${name}.`);
}

async function handleLoadGame({ source = "home" } = {}) {
	if (loadingGame) return;
	loadingGame = true;
	const isHome = source === "home";
	const triggerButton = isHome ? homeLoad : elements.load;
	const secondaryButton = isHome ? homeStart : null;
	const originalTriggerLabel = triggerButton ? triggerButton.textContent : "";
	const originalSecondaryLabel = secondaryButton ? secondaryButton.textContent : "";

	if (triggerButton) {
		triggerButton.disabled = true;
		triggerButton.textContent = "Loading...";
	}
	if (secondaryButton) {
		secondaryButton.disabled = true;
		secondaryButton.textContent = "Loading...";
	}
	if (isHome) {
		setHomeMessage("Select a save file to load.");
	}

	try {
		const result = await loadGameFromFile();
		if (result.status === "cancelled") {
			if (isHome) {
				setHomeMessage("Load cancelled.");
			}
			return;
		}
		if (result.status === "error") {
			console.error(result.error);
			if (isHome) {
				setHomeMessage(result.message || "Failed to read the save file.");
			} else {
				window.alert(result.message || "Failed to read the save file.");
			}
			return;
		}

		await engine.loadFromSave(result.data);
		hasLoadedStory = true;
		if (isHome) {
			setHomeMessage("");
			revealGame();
		}
	} catch (error) {
		console.error(error);
		if (isHome) {
			setHomeMessage("Loading the save file failed.");
		} else {
			window.alert("Loading the save file failed.");
		}
	} finally {
		if (triggerButton) {
			triggerButton.disabled = false;
			triggerButton.textContent = originalTriggerLabel || "Load Game";
		}
		if (secondaryButton) {
			secondaryButton.disabled = false;
			secondaryButton.textContent = originalSecondaryLabel || "New Game";
		}
		loadingGame = false;
	}
}
