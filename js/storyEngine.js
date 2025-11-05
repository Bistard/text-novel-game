import { parseStory } from "./storyParser.js";
import { StoryRenderer } from "./storyRenderer.js";
import { StoryState } from "./storyState.js";
import { runRoll } from "./rollSystem.js";
import { formatSigned } from "./storyUtilities.js";
import { loadStatConfig } from "./statConfig.js";

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
	 */
	constructor(options) {
		this.renderer = new StoryRenderer(options);
		this.state = new StoryState();
		this.story = null;
		this.choiceInProgress = false;
		this.storyUrl = null;
		this.statsConfigUrl = null;
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
		this.state.configureStats(statDefaults);
		this.resetState();
		this.render();
	}

	/** Resets the runtime state to the defaults. */
	resetState() {
		if (!this.story) return;
		this.state.reset(this.story.start);
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
		if (typeof this.renderer.syncSkipButtonState === "function") {
			if (typeof globalThis.queueMicrotask === "function") {
				globalThis.queueMicrotask(() => this.renderer.syncSkipButtonState());
			} else {
				globalThis.setTimeout(() => this.renderer.syncSkipButtonState(), 0);
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

		if (this.choiceInProgress) {
			return;
		}

		this.choiceInProgress = true;

		const choice = branch.choices.find((entry) => entry.id === choiceId);
		if (!choice) {
			this.choiceInProgress = false;
			return;
		}

		try {
			this.state.clearSystemError();
			this.state.clearLastRoll();

			const summaries = [];
			let rollOutcomeLabel = null;
			let nextBranchId = choice.next || null;

			const unknownStatNames = new Set();
			const statEvaluationIssues = [];
			const evaluateStatEffects = (effects, context = {}) => {
				const partition = this.state.partitionStatEffects(effects || []);
				for (const name of partition.unknown) {
					if (name) {
						unknownStatNames.add(name);
					}
				}
				const evaluation = this.state.evaluateStatEffects(partition.allowed, context);
				if (evaluation.issues.length) {
					statEvaluationIssues.push(...evaluation.issues);
				}
				return evaluation.evaluated;
			};

			let evaluatedStatEffects = [];
			let inventoryEffectsToApply = [];

			if (choice.roll) {
				const rollResult = runRoll(choice.roll, (stat) => this.state.getStatValue(stat));
				if (rollResult.success) {
					evaluatedStatEffects = evaluateStatEffects(choice.stats, { rollResult });
					inventoryEffectsToApply = Array.isArray(choice.inventory) ? choice.inventory.slice() : [];
					rollOutcomeLabel = "Roll: Success";
				} else {
					rollOutcomeLabel = "Roll: Failure";
				}
				try {
					await this.renderer.showRollResult(rollResult, {
						statEffects: evaluatedStatEffects,
					});
				} catch (error) {
					console.error("Dice animation failed:", error);
				}
				this.state.clearLastRoll();
				nextBranchId = rollResult.success ? choice.roll.ok : choice.roll.fail;
			} else {
				evaluatedStatEffects = evaluateStatEffects(choice.stats);
				inventoryEffectsToApply = Array.isArray(choice.inventory) ? choice.inventory.slice() : [];
			}

			if (rollOutcomeLabel) {
				summaries.push(rollOutcomeLabel);
			}

			if (evaluatedStatEffects.length) {
				const appliedStats = this.state.applyEvaluatedStatEffects(evaluatedStatEffects);
				const labels = appliedStats.map((effect) => `${effect.stat} ${formatSigned(effect.delta)}`);
				summaries.push(`Stats: ${labels.join(", ")}`);
			}

			if (inventoryEffectsToApply.length) {
				this.state.applyInventoryEffects(inventoryEffectsToApply);
				const labels = inventoryEffectsToApply.map((effect) => `${effect.item} ${formatSigned(effect.delta)}`);
				summaries.push(`Inventory: ${labels.join(", ")}`);
			}

			const journalEntry = summaries.length
				? `${choice.text} → ${summaries.join(" | ")}`
				: `${choice.text}`;
			this.state.appendJournal(journalEntry);

			if (!this.state.systemError) {
				if (unknownStatNames.size) {
					const names = Array.from(unknownStatNames).sort((a, b) => a.localeCompare(b));
					console.warn("Unknown stat(s) encountered:", names);
					const suffix = names.length > 1 ? "s" : "";
					this.state.setSystemError(
						`Unknown stat${suffix} encountered: ${names.join(", ")}. Update the stat config.`
					);
				} else if (statEvaluationIssues.length) {
					const message = statEvaluationIssues.join(" | ");
					console.warn("Dynamic stat resolution issues:", message);
					this.state.setSystemError(message);
				}
			}

			if (!nextBranchId) {
				this.state.setSystemError("Choice does not specify a destination branch.");
				this.render();
				return;
			}

			if (!this.story.branches[nextBranchId]) {
				this.state.setSystemError(`Missing branch "${nextBranchId}".`);
				this.render();
				return;
			}

			this.state.setCurrentBranch(nextBranchId);
			this.render();
		} finally {
			this.choiceInProgress = false;
		}
	}

	/** Refreshes the UI elements. */
	render() {
		const branch = this.getCurrentBranch();
		this.renderer.render(branch, this.state, (choiceId) => this.handleChoice(choiceId));
	}

	/**
	 * Builds a payload suitable for saving to disk.
	 * @returns {import("./saveSystem.js").SerializedSaveData}
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
	 * @param {import("./saveSystem.js").SerializedSaveData} saveData
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

		this.state.restoreSnapshot(saveData.state);
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

/**
 * @typedef {Object} StoryBranch
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {StoryChoice[]} choices
 */

/**
 * @typedef {Object} StoryChoice
 * @property {string} id
 * @property {string} text
 * @property {string|null} next
 * @property {{ stat: string, delta: number, dynamic?: { type: "roll-total"|"roll-dice"|"roll-stat", scale: number } }[]} stats
 * @property {{ item: string, delta: number }[]} inventory
 * @property {import("./storyUtilities.js").RollDirective|null} roll
 */
