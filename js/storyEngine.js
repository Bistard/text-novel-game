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
	 */
	constructor(options) {
		this.renderer = new StoryRenderer(options);
		this.state = new StoryState();
		this.story = null;
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
	}

	/**
	 * Handles the player picking a choice button.
	 * @param {string} choiceId
	 */
	handleChoice(choiceId) {
		const branch = this.getCurrentBranch();
		if (!branch) return;

		const choice = branch.choices.find((entry) => entry.id === choiceId);
		if (!choice) return;

		this.state.clearSystemError();
		this.state.clearLastRoll();

		const summaries = [];

		if (choice.stats.length) {
			this.state.applyStatEffects(choice.stats);
			const labels = choice.stats.map((effect) => `${effect.stat} ${formatSigned(effect.delta)}`);
			summaries.push(`Stats: ${labels.join(", ")}`);
		}

		if (choice.inventory.length) {
			this.state.applyInventoryEffects(choice.inventory);
			const labels = choice.inventory.map((effect) => `${effect.item} ${formatSigned(effect.delta)}`);
			summaries.push(`Inventory: ${labels.join(", ")}`);
		}

		let nextBranchId = choice.next || null;

		if (choice.roll) {
			const rollResult = runRoll(choice.roll, (stat) => this.state.getStatValue(stat));
			this.state.setLastRoll(rollResult);
			nextBranchId = rollResult.success ? choice.roll.ok : choice.roll.fail;
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
