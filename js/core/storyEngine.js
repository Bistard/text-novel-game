import { parseStory } from "../storyParser.js";
import { StoryRenderer } from "../storyRenderer.js";
import { StoryState } from "../state/storyState.js";
import { runRoll } from "../rollSystem.js";
import { formatSigned } from "../storyUtilities.js";
import { loadStatConfig } from "../statConfig.js";
import { processChoiceSelection } from "./choiceProcessor.js";
import { t } from "../i18n/index.js";

export class StoryEngine {
	/**
	 * @param {object} options
	 * @param {HTMLElement} options.nodeTitle
	 * @param {HTMLElement} options.storyText
	 * @param {HTMLElement} options.choices
	 * @param {HTMLElement} options.stats
	 * @param {HTMLElement} options.journal
	 * @param {HTMLElement} options.inventory
	 * @param {HTMLElement} options.systemMessages
	 * @param {HTMLElement} options.titleElement
	 * @param {HTMLElement} [options.skipButton]
	 * @param {HTMLElement} [options.skipToggle]
	 */
	constructor(options) {
		this.renderer = new StoryRenderer(options);
		this.state = new StoryState();
		this.story = null;
		this.choiceInProgress = false;
		this.choiceHistory = [];
		this.stateChangeCallback = null;
		this.storyUrl = null;
		this.statsConfigUrl = null;
		this.staminaAlertShown = false;
	}

	/**
	 * Loads the story text file and initialises the engine.
	 * @param {string} storyUrl
	 * @param {string} [statsConfigUrl]
	 */
	async load(storyUrl, statsConfigUrl = "assets/stats.config") {
		this.storyUrl = storyUrl;
		this.statsConfigUrl = statsConfigUrl != null ? statsConfigUrl : "assets/stats.config";

		const storyPromise = fetch(storyUrl).then((response) => {
			if (!response.ok) {
				throw new Error(`Failed to load story file (${response.status}).`);
			}
			return response.text();
		});
		const statsPromise =
			statsConfigUrl != null && statsConfigUrl !== ""
				? loadStatConfig(statsConfigUrl)
				: Promise.resolve({});

		const [storyText, statDefaults] = await Promise.all([storyPromise, statsPromise]);

		this.story = parseStory(storyText);
		if (this.renderer && typeof this.renderer.setStory === "function") {
			this.renderer.setStory(this.story);
		}
		this.state.configureStats(statDefaults);
		this.resetState();
		this.render();
	}

	/** Resets the runtime state to the defaults. */
	resetState() {
		if (!this.story) return;
		this.clearUndoHistory({ silent: true });
		this.state.reset(this.story.start);
		this.staminaAlertShown = false;
	}

	/** Returns the active branch, or null if unavailable. */
	getCurrentBranch() {
		if (!this.story) return null;
		const id = this.state.getCurrentBranchId();
		if (!id) return null;
		return this.story.branches[id] || null;
	}

	/** Restart the story from the first branch. */
	restart() {
		this.resetState();
		this.render();
		const shouldSync =
			typeof this.renderer.syncSkipButtonState === "function" ||
			typeof this.renderer.syncSkipToggleState === "function";
		if (shouldSync) {
			const syncControls = () => {
				if (typeof this.renderer.syncSkipButtonState === "function") {
					this.renderer.syncSkipButtonState();
				}
				if (typeof this.renderer.syncSkipToggleState === "function") {
					this.renderer.syncSkipToggleState();
				}
			};
			if (typeof globalThis.queueMicrotask === "function") {
				globalThis.queueMicrotask(syncControls);
			} else {
				globalThis.setTimeout(syncControls, 0);
			}
		}
	}

	/**
	 * Handles the player picking a choice button.
	 * @param {string} choiceId
	 */
	async handleChoice(choiceId) {
		const branch = this.getCurrentBranch();
		if (!branch) return;
		const currentBranchId = branch.id || this.state.getCurrentBranchId();

		if (this.choiceInProgress) {
			return;
		}

		this.choiceInProgress = true;
		this.notifyStateChange();

		const choice = branch.choices.find((entry) => entry.id === choiceId);
		if (!choice) {
			this.choiceInProgress = false;
			this.notifyStateChange();
			return;
		}
		if (choice.visibilityCondition && !this.state.evaluateCondition(choice.visibilityCondition)) {
			this.choiceInProgress = false;
			this.notifyStateChange();
			return;
		}
		if (choice.validCondition && !this.state.evaluateCondition(choice.validCondition)) {
			this.choiceInProgress = false;
			this.notifyStateChange();
			return;
		}

		const previousHistoryLength = this.choiceHistory.length;
		const snapshot = this.state.createSnapshot();
		this.choiceHistory.push(snapshot);

		try {
			this.state.clearSystemError();
			this.state.clearLastRoll();

			const { nextBranchId } = await processChoiceSelection({
				choice,
				state: this.state,
				renderer: this.renderer,
				runRollImpl: runRoll,
				formatSigned,
			});

			if (!nextBranchId) {
				this.choiceHistory.splice(previousHistoryLength);
				this.state.setSystemError("Choice does not specify a destination branch.");
				this.render();
				return;
			}

			if (!this.story.branches[nextBranchId]) {
				this.choiceHistory.splice(previousHistoryLength);
				this.state.setSystemError(`Missing branch "${nextBranchId}".`);
				this.render();
				return;
			}

			if (currentBranchId) {
				this.state.markBranchTransition(currentBranchId, nextBranchId);
			}
			this.state.setCurrentBranch(nextBranchId);

			this.render();
		} catch (error) {
			this.choiceHistory.splice(previousHistoryLength);
			throw error;
		} finally {
			this.choiceInProgress = false;
			this.notifyStateChange();
		}
	}

	/** Refreshes the UI elements. */
	render() {
		const branch = this.getCurrentBranch();
		this.renderer.render(branch, this.state, (choiceId) => this.handleChoice(choiceId));
		this.checkStaminaDepletion();
		this.notifyStateChange();
	}

	setStateChangeListener(handler) {
		this.stateChangeCallback = typeof handler === "function" ? handler : null;
		this.notifyStateChange();
	}

	notifyStateChange() {
		if (typeof this.stateChangeCallback !== "function") {
			return;
		}
		this.stateChangeCallback({
			canUndo: this.canUndo(),
			isProcessingChoice: this.choiceInProgress,
			currentBranchId: this.state.getCurrentBranchId(),
		});
	}

	checkStaminaDepletion() {
		if (!this.state || !this.state.stats || !Object.prototype.hasOwnProperty.call(this.state.stats, "stamina")) {
			this.staminaAlertShown = false;
			return;
		}

		const stamina = this.state.getStatValue("stamina");
		if (!Number.isFinite(stamina)) {
			return;
		}

		if (stamina <= 0) {
			if (this.staminaAlertShown) {
				return;
			}
			this.staminaAlertShown = true;
			if (typeof window !== "undefined" && typeof window.alert === "function") {
				window.alert(t("messages.gameOver"));
			}
		} else if (this.staminaAlertShown) {
			this.staminaAlertShown = false;
		}
	}

	canUndo() {
		return this.choiceHistory.length > 0;
	}

	clearUndoHistory(options = {}) {
		this.choiceHistory = [];
		if (!options || options.silent !== true) {
			this.notifyStateChange();
		}
	}

	undoLastChoice() {
		if (!this.canUndo() || this.choiceInProgress) {
			return false;
		}

		const snapshot = this.choiceHistory.pop();
		if (!snapshot) {
			this.clearUndoHistory({ silent: true });
			this.notifyStateChange();
			return false;
		}

		this.state.restoreSnapshot(snapshot);
		this.render();
		return true;
	}

	/**
	 * Builds a payload suitable for saving to disk.
	 * @returns {import("../saveSystem.js").SerializedSaveData}
	 */
	createSavePayload() {
		if (!this.story) {
			throw new Error("No story loaded to save.");
		}

		const branch = this.getCurrentBranch();
		return {
			version: 1,
			createdAt: new Date().toISOString(),
			story: {
				url: this.storyUrl || "assets/story.txt",
				statsConfigUrl: this.statsConfigUrl || "assets/stats.config",
				start: this.story.start,
				currentBranchId: this.state.getCurrentBranchId(),
				currentBranchTitle: branch ? branch.title : null,
			},
			state: this.state.createSnapshot(),
		};
	}

	/**
	 * Restores the engine from previously saved data.
	 * @param {import("../saveSystem.js").SerializedSaveData} saveData
	 */
	async loadFromSave(saveData) {
		if (!saveData || typeof saveData !== "object") {
			throw new Error("Invalid save data.");
		}
		if (saveData.version !== 1) {
			throw new Error(`Unsupported save version "${saveData.version}".`);
		}

		const storyInfo = saveData.story || {};
		const targetStoryUrl = storyInfo.url || this.storyUrl || "assets/story.txt";
		const targetStatsConfigUrl =
			storyInfo.statsConfigUrl != null ? storyInfo.statsConfigUrl : this.statsConfigUrl || "assets/stats.config";

		if (!this.story || this.storyUrl !== targetStoryUrl || this.statsConfigUrl !== targetStatsConfigUrl) {
			await this.load(targetStoryUrl, targetStatsConfigUrl);
		}

		if (!saveData.state) {
			throw new Error("Save data missing required state information.");
		}

		this.clearUndoHistory({ silent: true });
		this.state.restoreSnapshot(saveData.state);
		this.staminaAlertShown = false;
		const branchId = this.state.getCurrentBranchId();
		if (!branchId || !this.story.branches[branchId]) {
			const fallback = this.story.start;
			const message = branchId
				? `Saved branch "${branchId}" is unavailable. Reverting to the story start.`
				: "Save data was missing the current location. Returning to the story start.";
			this.state.setCurrentBranch(fallback);
			this.state.setSystemError(message);
		}

		this.render();
	}
}
