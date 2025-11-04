import { parseStory } from "./storyParser.js";
import { StoryRenderer } from "./storyRenderer.js";
import { StoryState } from "./storyState.js";
import { runRoll } from "./rollSystem.js";
import { formatSigned } from "./storyUtilities.js";

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
	}

	/**
	 * Loads the story text file and initialises the engine.
	 * @param {string} url
	 */
	async load(url) {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to load story file (${response.status}).`);
		}
		const text = await response.text();
		this.story = parseStory(text);
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

			const statEffectsToApply = [];
			const inventoryEffectsToApply = [];

			if (choice.roll) {
				const rollResult = runRoll(choice.roll, (stat) => this.state.getStatValue(stat));
				if (rollResult.success) {
					statEffectsToApply.push(...choice.stats);
					inventoryEffectsToApply.push(...choice.inventory);
					rollOutcomeLabel = "Roll: Success";
				} else {
					rollOutcomeLabel = "Roll: Failure";
				}
				try {
					await this.renderer.showRollResult(rollResult, {
						statEffects: statEffectsToApply,
					});
				} catch (error) {
					console.error("Dice animation failed:", error);
				}
				this.state.clearLastRoll();
				nextBranchId = rollResult.success ? choice.roll.ok : choice.roll.fail;
			} else {
				statEffectsToApply.push(...choice.stats);
				inventoryEffectsToApply.push(...choice.inventory);
			}

			if (rollOutcomeLabel) {
				summaries.push(rollOutcomeLabel);
			}

			if (statEffectsToApply.length) {
				this.state.applyStatEffects(statEffectsToApply);
				const labels = statEffectsToApply.map((effect) => `${effect.stat} ${formatSigned(effect.delta)}`);
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
 * @property {{ stat: string, delta: number }[]} stats
 * @property {{ item: string, delta: number }[]} inventory
 * @property {import("./storyUtilities.js").RollDirective|null} roll
 */
