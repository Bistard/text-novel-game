import { chunkParagraphs, formatLabel, buildRollSummary } from "./storyUtilities.js";

const DOCUMENT_SUFFIX = "Narrative Demo";

/**
 * Handles DOM updates for the interactive story.
 */
export class StoryRenderer {
	/**
	 * @param {object} elements
	 * @param {HTMLElement} [elements.nodeTitle]
	 * @param {HTMLElement} [elements.storyText]
	 * @param {HTMLElement} [elements.choices]
	 * @param {HTMLElement} [elements.stats]
	 * @param {HTMLElement} [elements.journal]
	 * @param {HTMLElement} [elements.inventory]
	 * @param {HTMLElement} [elements.systemMessages]
	 * @param {HTMLElement} [elements.titleElement]
	 */
	constructor(elements) {
		this.elements = elements;
	}

	/**
	 * @param {StoryBranch|null} branch
	 * @param {import("./storyState.js").StoryState} state
	 * @param {(choiceId: string) => void} onChoiceSelected
	 */
	render(branch, state, onChoiceSelected) {
		if (!branch) {
			this.renderEmptyState(state);
			return;
		}

		this.renderTitle(branch);
		this.renderStory(branch);
		this.renderChoices(branch, onChoiceSelected);
		this.renderStats(state);
		this.renderInventory(state);
		this.renderJournal(state);
		this.renderSystemMessages(state);
	}

	/**
	 * @param {StoryBranch} branch
	 */
	renderTitle(branch) {
		if (this.elements.nodeTitle) {
			this.elements.nodeTitle.textContent = branch.title;
		}
		if (this.elements.titleElement) {
			this.elements.titleElement.textContent = branch.title;
		}
		document.title = `${branch.title} — ${DOCUMENT_SUFFIX}`;
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
	 * @param {(choiceId: string) => void} onChoiceSelected
	 */
	renderChoices(branch, onChoiceSelected) {
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

		const handler = typeof onChoiceSelected === "function" ? onChoiceSelected : () => {};

		for (const choice of branch.choices) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "choice-button";
			button.dataset.choiceId = choice.id;
			button.textContent = choice.text;
			button.addEventListener("click", () => handler(choice.id));
			container.appendChild(button);
		}
	}

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderStats(state) {
		const container = this.elements.stats;
		if (!container) return;
		container.innerHTML = "";

		const entries = Object.entries(state.stats).filter(([, value]) => value !== 0);
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

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderInventory(state) {
		const list = this.elements.inventory;
		if (!list) return;
		list.innerHTML = "";

		const entries = Object.entries(state.inventory).filter(([, count]) => count > 0);
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

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderJournal(state) {
		const list = this.elements.journal;
		if (!list) return;
		list.innerHTML = "";

		if (!state.journal.length) {
			const placeholder = document.createElement("li");
			placeholder.className = "muted";
			placeholder.textContent = "No actions recorded yet.";
			list.appendChild(placeholder);
			return;
		}

		for (const entry of state.journal.slice().reverse()) {
			const li = document.createElement("li");
			li.textContent = entry;
			list.appendChild(li);
		}
	}

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderSystemMessages(state) {
		const container = this.elements.systemMessages;
		if (!container) return;
		container.innerHTML = "";

		if (state.systemError) {
			const p = document.createElement("p");
			p.className = "roll-result failure";
			p.textContent = state.systemError;
			container.appendChild(p);
			return;
		}

		const rollResult = state.lastRoll;
		if (!rollResult) return;

		const p = document.createElement("p");
		p.className = `roll-result ${rollResult.success ? "success" : "failure"}`;
		p.textContent = buildRollSummary(rollResult);
		container.appendChild(p);
	}

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderEmptyState(state) {
		if (this.elements.nodeTitle) {
			this.elements.nodeTitle.textContent = "Story unavailable";
		}
		if (this.elements.storyText) {
			this.elements.storyText.textContent = state.systemError
				? state.systemError
				: "Unable to locate the next branch.";
		}
		if (this.elements.choices) {
			this.elements.choices.innerHTML = "";
		}

		this.renderStats(state);
		this.renderInventory(state);
		this.renderJournal(state);
		this.renderSystemMessages(state);
		document.title = `Story unavailable — ${DOCUMENT_SUFFIX}`;
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
