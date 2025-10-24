import { parseStory } from "./storyParser.js";

const MAX_JOURNAL_ENTRIES = 8;

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
	constructor({
		nodeTitle,
		storyText,
		choices,
		stats,
		journal,
		inventory,
		systemMessages,
		titleElement,
	}) {
		this.elements = {
			nodeTitle,
			storyText,
			choices,
			stats,
			journal,
			inventory,
			systemMessages,
			titleElement,
		};

		this.story = null;
		this.state = {
			currentBranchId: null,
			stats: {},
			inventory: {},
			journal: [],
			lastRoll: null,
			systemError: null,
		};
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
		this.state.currentBranchId = this.story.start;
		this.state.stats = {};
		this.state.inventory = {};
		this.state.journal = [];
		this.state.lastRoll = null;
		this.state.systemError = null;

		const startBranch = this.getCurrentBranch();
		if (this.elements.titleElement && startBranch) {
			this.elements.titleElement.textContent = startBranch.title;
		}
		if (startBranch) {
			document.title = `${startBranch.title} — Narrative Demo`;
		}
	}

	/** Returns the active branch, or null if unavailable. */
	getCurrentBranch() {
		if (!this.story || !this.state.currentBranchId) return null;
		return this.story.branches[this.state.currentBranchId] || null;
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

		this.state.systemError = null;

		const summaries = [];

		if (choice.stats.length) {
			this.applyStatEffects(choice.stats);
			const labels = choice.stats.map((effect) => `${effect.stat} ${formatSigned(effect.delta)}`);
			summaries.push(`Stats: ${labels.join(", ")}`);
		}

		if (choice.inventory.length) {
			this.applyInventoryEffects(choice.inventory);
			const labels = choice.inventory.map((effect) => `${effect.item} ${formatSigned(effect.delta)}`);
			summaries.push(`Inventory: ${labels.join(", ")}`);
		}

		let nextBranchId = choice.next || null;
		let rollResult = null;

		if (choice.roll) {
			rollResult = this.runRoll(choice.roll);
			this.state.lastRoll = rollResult;
			nextBranchId = rollResult.success ? choice.roll.ok : choice.roll.fail;
			summaries.push(buildRollSummary(rollResult));
		} else {
			this.state.lastRoll = null;
		}

		const journalEntry = summaries.length
			? `${choice.text} → ${summaries.join(" | ")}`
			: `${choice.text}`;
		this.appendJournal(journalEntry);

		if (!nextBranchId) {
			this.state.systemError = "Choice does not specify a destination branch.";
			this.render();
			return;
		}

		if (!this.story.branches[nextBranchId]) {
			this.state.systemError = `Missing branch "${nextBranchId}".`;
			this.render();
			return;
		}

		this.state.currentBranchId = nextBranchId;
		this.render();
	}

	/**
	 * Applies stat adjustments from the choice.
	 * @param {{ stat: string, delta: number }[]} effects
	 */
	applyStatEffects(effects) {
		for (const effect of effects) {
			const current = this.state.stats[effect.stat] || 0;
			this.state.stats[effect.stat] = current + effect.delta;
		}
	}

	/**
	 * Applies inventory adjustments from the choice.
	 * @param {{ item: string, delta: number }[]} effects
	 */
	applyInventoryEffects(effects) {
		for (const effect of effects) {
			const current = this.state.inventory[effect.item] || 0;
			const updated = current + effect.delta;
			if (updated <= 0) {
				delete this.state.inventory[effect.item];
			} else {
				this.state.inventory[effect.item] = updated;
			}
		}
	}

	/**
	 * Executes a randomisation test based on the player's stats.
	 * @param {RollDirective} directive
	 * @returns {RollResult}
	 */
	runRoll(directive) {
		const statValue = directive.stat ? this.state.stats[directive.stat] || 0 : 0;
		const rolls = [];
		let diceTotal = 0;

		for (let i = 0; i < directive.dice.count; i += 1) {
			const roll = randomInt(1, directive.dice.sides);
			rolls.push(roll);
			diceTotal += roll;
		}

		const total = statValue + diceTotal;
		const success = total >= directive.target;

		return {
			directive,
			statValue,
			rolls,
			diceTotal,
			total,
			success,
		};
	}

	/**
	 * Adds a line to the journal, keeping the most recent entries.
	 * @param {string} text
	 */
	appendJournal(text) {
		if (!text) return;
		this.state.journal.push(text);
		if (this.state.journal.length > MAX_JOURNAL_ENTRIES) {
			this.state.journal.splice(0, this.state.journal.length - MAX_JOURNAL_ENTRIES);
		}
	}

	/** Refreshes the UI elements. */
	render() {
		const branch = this.getCurrentBranch();
		if (!branch) {
			this.renderEmptyState();
			return;
		}

		this.renderTitle(branch);
		this.renderStory(branch);
		this.renderChoices(branch);
		this.renderStats();
		this.renderInventory();
		this.renderJournal();
		this.renderSystemMessages();
	}

	renderEmptyState() {
		if (this.elements.nodeTitle) {
			this.elements.nodeTitle.textContent = "Story unavailable";
		}
		if (this.elements.storyText) {
			this.elements.storyText.textContent = this.state.systemError
				? this.state.systemError
				: "Unable to locate the next branch.";
		}
		if (this.elements.choices) {
			this.elements.choices.innerHTML = "";
		}
		this.renderStats();
		this.renderInventory();
		this.renderJournal();
		this.renderSystemMessages();
	}

	/**
	 * @param {StoryBranch} branch
	 */
	renderTitle(branch) {
		if (this.elements.nodeTitle) {
			this.elements.nodeTitle.textContent = branch.title;
		}
	}

	/**
	 * @param {StoryBranch} branch
	 */
	renderStory(branch) {
		const container = this.elements.storyText;
		if (!container) return;
		container.innerHTML = "";

		const paragraphs = chunkParagraphs(branch.description);
		if (!paragraphs.length) {
			container.textContent = branch.description;
			return;
		}

		for (const text of paragraphs) {
			const p = document.createElement("p");
			p.textContent = text;
			container.appendChild(p);
		}
	}

	/**
	 * @param {StoryBranch} branch
	 */
	renderChoices(branch) {
		const container = this.elements.choices;
		if (!container) return;
		container.innerHTML = "";

		if (!branch.choices.length) {
			const message = document.createElement("p");
			message.className = "muted";
			message.textContent = "This path has no further choices.";
			container.appendChild(message);
			return;
		}

		for (const choice of branch.choices) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "choice-button";
			button.dataset.choiceId = choice.id;
			button.textContent = choice.text;
			button.addEventListener("click", () => this.handleChoice(choice.id));
			container.appendChild(button);
		}
	}

	renderStats() {
		const container = this.elements.stats;
		if (!container) return;
		container.innerHTML = "";

		const entries = Object.entries(this.state.stats).filter(([, value]) => value !== 0);
		if (!entries.length) {
			const placeholder = document.createElement("div");
			placeholder.className = "muted";
			placeholder.textContent = "No stats yet.";
			container.appendChild(placeholder);
			return;
		}

		entries.sort((a, b) => a[0].localeCompare(b[0]));

		for (const [stat, value] of entries) {
			const dt = document.createElement("dt");
			dt.textContent = formatLabel(stat);
			container.appendChild(dt);

			const dd = document.createElement("dd");
			dd.textContent = String(value);
			container.appendChild(dd);
		}
	}

	renderInventory() {
		const list = this.elements.inventory;
		if (!list) return;
		list.innerHTML = "";

		const entries = Object.entries(this.state.inventory).filter(([, count]) => count > 0);
		if (!entries.length) {
			const placeholder = document.createElement("li");
			placeholder.textContent = "Inventory empty.";
			placeholder.className = "muted";
			list.appendChild(placeholder);
			return;
		}

		entries.sort((a, b) => a[0].localeCompare(b[0]));

		for (const [item, count] of entries) {
			const li = document.createElement("li");
			li.textContent = count === 1 ? item : `${item} ×${count}`;
			list.appendChild(li);
		}
	}

	renderJournal() {
		const list = this.elements.journal;
		if (!list) return;
		list.innerHTML = "";

		if (!this.state.journal.length) {
			const placeholder = document.createElement("li");
			placeholder.className = "muted";
			placeholder.textContent = "No actions recorded yet.";
			list.appendChild(placeholder);
			return;
		}

		for (const entry of this.state.journal.slice().reverse()) {
			const li = document.createElement("li");
			li.textContent = entry;
			list.appendChild(li);
		}
	}

	renderSystemMessages() {
		const container = this.elements.systemMessages;
		if (!container) return;
		container.innerHTML = "";

		if (this.state.systemError) {
			const p = document.createElement("p");
			p.className = "roll-result failure";
			p.textContent = this.state.systemError;
			container.appendChild(p);
			return;
		}

		const rollResult = this.state.lastRoll;
		if (!rollResult) return;

		const p = document.createElement("p");
		p.className = `roll-result ${rollResult.success ? "success" : "failure"}`;
		p.textContent = buildRollSummary(rollResult);
		container.appendChild(p);
	}
}

/**
 * Breaks a raw description into clean paragraphs.
 * @param {string} text
 * @returns {string[]}
 */
function chunkParagraphs(text) {
	const lines = text.split(/\n/);
	const paragraphs = [];
	let buffer = [];

	const flush = () => {
		if (!buffer.length) return;
		paragraphs.push(buffer.join(" ").trim());
		buffer = [];
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			flush();
		} else {
			buffer.push(trimmed);
		}
	}
	flush();

	return paragraphs.filter(Boolean);
}

/**
 * @param {number} min
 * @param {number} max
 */
function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {string} value
 */
function formatLabel(value) {
	return value
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

/**
 * @param {number} value
 */
function formatSigned(value) {
	return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * Builds a human-readable summary of the most recent roll.
 * @param {RollResult} result
 */
function buildRollSummary(result) {
	const parts = [];
	if (result.directive.stat) {
		parts.push(`${formatLabel(result.directive.stat)} ${formatSigned(result.statValue)}`);
	}
	if (result.rolls.length) {
		const diceLabel =
			result.directive.dice.count === 1
				? `d${result.directive.dice.sides}`
				: `${result.directive.dice.count}d${result.directive.dice.sides}`;
		parts.push(`${diceLabel} → ${result.rolls.join(", ")}`);
	}
	parts.push(`Total ${result.total} / Target ${result.directive.target}`);
	parts.push(result.success ? "Success" : "Failure");
	return parts.join(" | ");
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
 * @property {RollDirective|null} roll
 */

/**
 * @typedef {Object} RollDirective
 * @property {string|null} stat
 * @property {{ count: number, sides: number }} dice
 * @property {number} target
 * @property {string} ok
 * @property {string} fail
 */

/**
 * @typedef {Object} RollResult
 * @property {RollDirective} directive
 * @property {number} statValue
 * @property {number[]} rolls
 * @property {number} diceTotal
 * @property {number} total
 * @property {boolean} success
 */
