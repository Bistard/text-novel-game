import { StoryEngine } from "./storyEngine.js";
import { saveGameToFile, loadGameFromFile } from "./saveSystem.js";
import {
	t,
	setLanguage,
	getAvailableLanguages,
	getCurrentLanguage,
	onLanguageChange,
	bindText,
	bindAttribute,
} from "./i18n/index.js";

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
const homeTitle = document.getElementById("home-title");
const homeTagline = document.querySelector(".home-tagline");
const homeLanguageInfo = document.getElementById("home-language-info");
const homeTeamTitle = document.getElementById("team-title");
const languageSelectHome = document.getElementById("language-select-home");
const languageSelectApp = document.getElementById("language-select-app");
const languageLabelHome = document.querySelector('label[for="language-select-home"]');
const languageLabelApp = document.querySelector('label[for="language-select-app"]');
const languageBanner = document.getElementById("language-banner");
const journalTitle = document.getElementById("journal-title");
const statsTitle = document.getElementById("stats-title");
const inventoryTitle = document.getElementById("inventory-title");
const choicesTitle = document.getElementById("choices-title");
const graphTitle = document.getElementById("graph-title");
const headerActions = document.querySelector(".header-actions");
const storyControls = document.querySelector(".story-controls");
const graphControls = document.querySelector(".graph-controls");

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

initializeLanguageSelectors();
setupStaticBindings();
onLanguageChange(handleLanguageChange);
handleLanguageChange(getCurrentLanguage());

function initializeLanguageSelectors() {
	const options = getAvailableLanguages();
	populateLanguageSelect(languageSelectHome, options);
	populateLanguageSelect(languageSelectApp, options);
	const current = getCurrentLanguage();
	syncLanguageSelectors(current);

	if (languageSelectHome) {
		languageSelectHome.addEventListener("change", (event) => {
			const selected = event.target && event.target.value ? event.target.value : null;
			if (selected) {
				setLanguage(selected);
			}
		});
	}

	if (languageSelectApp) {
		languageSelectApp.addEventListener("change", (event) => {
			const selected = event.target && event.target.value ? event.target.value : null;
			if (selected) {
				setLanguage(selected);
			}
		});
	}
}

function setupStaticBindings() {
	bindText(homeTitle, "app.gameTitle");
	bindText(homeTagline, "app.tagline");
	bindText(homeTeamTitle, "app.teamTitle");

	bindText(languageLabelHome, "common.language");
	bindText(languageLabelApp, "common.language");
	bindAttribute(languageSelectHome, "aria-label", "common.language");
	bindAttribute(languageSelectApp, "aria-label", "common.language");

	bindText(elements.save, "common.saveGame");
	bindText(elements.home, "common.returnHome");
	bindAttribute(elements.home, "aria-label", "common.returnHome");
	bindText(elements.restart, "common.restart");
	bindAttribute(elements.restart, "aria-label", "common.restart");
	bindText(elements.undo, "common.undo");

	bindText(elements.graphOpen, "common.storyMap");
	bindAttribute(elements.graphOpen, "aria-label", "common.storyMap");
	bindText(graphTitle, "graph.title");
	bindText(elements.graphToggle, "graph.showFullMap");
	bindText(elements.graphModeLabel, "graph.visitedBranches");
	bindText(elements.graphPlaceholder, "common.storyMapPlaceholder");
	bindText(elements.graphClose, "common.returnToGame");

	bindAttribute(headerActions, "aria-label", "common.gameActions");
	bindAttribute(storyControls, "aria-label", "common.textPlaybackOptions");
	bindAttribute(graphControls, "aria-label", "common.storyMapViewLabel");

	bindText(elements.skipButton, "common.skip");
	bindAttribute(elements.skipButton, "aria-label", "common.skipTextAnimation");

	bindText(choicesTitle, "common.choices");
	bindText(journalTitle, "common.journal");
	bindText(statsTitle, "common.stats");
	bindText(inventoryTitle, "common.inventory");
}

function populateLanguageSelect(select, options) {
	if (!select || !Array.isArray(options)) {
		return;
	}
	select.innerHTML = "";
	for (const option of options) {
		const choice = document.createElement("option");
		choice.value = option.code;
		choice.textContent = option.label;
		select.appendChild(choice);
	}
}

function syncLanguageSelectors(language) {
	if (languageSelectHome) {
		selectLanguageOption(languageSelectHome, language);
	}
	if (languageSelectApp) {
		selectLanguageOption(languageSelectApp, language);
	}
}

function selectLanguageOption(select, language) {
	if (!select) {
		return;
	}
	const target = typeof language === "string" ? language : getCurrentLanguage();
	const optionExists = Array.from(select.options).some((option) => option.value === target);
	if (optionExists) {
		select.value = target;
	} else if (select.options.length) {
		select.value = select.options[0].value;
	}
}

function handleLanguageChange(language) {
	const current = language || getCurrentLanguage();
	syncLanguageSelectors(current);
	updateDynamicLabels();
	updateLanguageNotices(current);
	if (hasLoadedStory) {
		engine.render();
		if (engine?.renderer && typeof engine.renderer.refreshGraphView === "function") {
			engine.renderer.refreshGraphView();
		}
	}
	if (engine?.renderer) {
		if (typeof engine.renderer.syncSkipToggleState === "function") {
			engine.renderer.syncSkipToggleState();
		}
		if (typeof engine.renderer.syncSkipButtonState === "function") {
			engine.renderer.syncSkipButtonState();
		}
	}
}

function updateDynamicLabels() {
	if (homeNote && !homeNote.textContent) {
		homeNote.hidden = true;
	}

	if (!hasLoadedStory) {
		if (elements.title) {
			elements.title.textContent = t("app.gameTitle");
		}
		updateDocumentTitleBase();
	}

	if (homeStart) {
		const isBusy = loadingGame && homeStart.disabled;
		homeStart.textContent = t(isBusy ? "common.loading" : "home.newGame");
	}

	if (homeLoad) {
		const isBusy = loadingGame && homeLoad.disabled;
		homeLoad.textContent = t(isBusy ? "common.loading" : "home.loadGame");
	}

	if (elements.load) {
		const isBusy = loadingGame && elements.load.disabled;
		elements.load.textContent = t(isBusy ? "common.loading" : "common.loadGame");
	}
}

function updateLanguageNotices(language) {
	const shouldShowNotice = language !== "en";

	if (homeLanguageInfo) {
		if (shouldShowNotice) {
			homeLanguageInfo.hidden = false;
			homeLanguageInfo.textContent = t("home.languageInfo");
		} else {
			homeLanguageInfo.textContent = "";
			homeLanguageInfo.hidden = true;
		}
	}

	if (languageBanner) {
		if (shouldShowNotice) {
			languageBanner.hidden = false;
			languageBanner.textContent = t("notice.storyPlaceholder");
		} else {
			languageBanner.textContent = "";
			languageBanner.hidden = true;
		}
	}
}

function updateDocumentTitleBase() {
	const base = t("app.gameTitle");
	const suffix = t("app.documentTitleSuffix");
	document.title = suffix ? `${base} - ${suffix}` : base;
}

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
		if (message) {
			homeNote.hidden = false;
			homeNote.textContent = message;
		} else {
			homeNote.textContent = "";
			homeNote.hidden = true;
		}
	}
}

function resetHomeState() {
	if (homeStart) {
		homeStart.disabled = false;
		homeStart.textContent = t("home.newGame");
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
	setHomeMessage("");
	if (homeStart) {
		homeStart.disabled = true;
		homeStart.textContent = t("common.loading");
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
		setHomeMessage(t("messages.failedToStartStory"));
		showFatalError(t("messages.unableToLoadStoryFile"));
	} finally {
		if (!gameVisible && homeStart) {
			homeStart.disabled = false;
			homeStart.textContent = t("home.newGame");
		}
		loadingGame = false;
	}
}

function showFatalError(message) {
	if (elements.nodeTitle) {
		elements.nodeTitle.textContent = t("messages.storyLoadFailedTitle");
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

		const confirmed = window.confirm(t("messages.restartConfirm"));
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
		const confirmed = window.confirm(t("messages.returnHomeConfirm"));
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

	const firstPrompt = t("messages.undoPromptPrimary");
	if (!window.confirm(firstPrompt)) {
		return;
	}

	const secondPrompt = t("messages.undoPromptSecondary");
	if (!window.confirm(secondPrompt)) {
		return;
	}

	const undone = engine.undoLastChoice();
	if (!undone) {
		window.alert(t("messages.undoUnavailable"));
	}
}

async function handleSaveClick() {
	if (!hasLoadedStory) {
		window.alert(t("messages.needRunningGameSave"));
		return;
	}

	let payload;
	try {
		payload = engine.createSavePayload();
	} catch (error) {
		console.error(error);
		window.alert(t("messages.unableToCaptureState"));
		return;
	}

	const result = await saveGameToFile(payload);
	if (result.status === "cancelled") {
		return;
	}
	if (result.status === "error") {
		console.error(result.error);
		window.alert(t("messages.saveFailed"));
		return;
	}

	const name = result.fileName || t("messages.saveFallbackName");
	window.alert(t("messages.gameSaved", { name }));
}

async function handleLoadGame({ source = "home" } = {}) {
	if (loadingGame) return;
	loadingGame = true;
	const isHome = source === "home";
	const triggerButton = isHome ? homeLoad : elements.load;
	const secondaryButton = isHome ? homeStart : null;
	if (triggerButton) {
		triggerButton.disabled = true;
		triggerButton.textContent = t("common.loading");
	}
	if (secondaryButton) {
		secondaryButton.disabled = true;
		secondaryButton.textContent = t("common.loading");
	}
	if (isHome) {
		setHomeMessage(t("messages.selectSaveFile"));
	}

	try {
		const result = await loadGameFromFile();
		if (result.status === "cancelled") {
			if (isHome) {
				setHomeMessage(t("messages.loadCancelled"));
			}
			return;
		}
		if (result.status === "error") {
			console.error(result.error);
			const message = result.message || t("messages.failedToReadSave");
			if (isHome) {
				setHomeMessage(message);
			} else {
				window.alert(message);
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
			setHomeMessage(t("messages.loadingSaveFailed"));
		} else {
			window.alert(t("messages.loadingSaveFailed"));
		}
	} finally {
		if (triggerButton) {
			triggerButton.disabled = false;
			triggerButton.textContent = t("common.loadGame");
		}
		if (secondaryButton) {
			secondaryButton.disabled = false;
			secondaryButton.textContent = t("home.newGame");
		}
		loadingGame = false;
	}
}
