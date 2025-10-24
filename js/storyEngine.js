import { parseStory } from "./storyParser.js";

const DEFAULT_DICE = { count: 1, sides: 6 };

/** Utility to deep copy plain objects */
function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

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
			currentNodeId: null,
			stats: {},
			inventory: [],
			journal: [],
			history: [],
			flags: new Set(),
			lastTestResult: null,
		};
	}

	/**
	 * Loads and initializes the story file.
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

	/** Resets state to defaults defined in meta */
	resetState() {
		const { meta } = this.story;
		this.state.stats = clone(meta.stats || {});
		this.state.inventory = Array.isArray(meta.inventory) ? [...meta.inventory] : [];
		this.state.journal = [];
		this.state.history = [];
		this.state.flags = new Set(meta.tags || []);
		this.state.lastTestResult = null;
		this.state.currentNodeId = meta.start;

		if (this.elements.titleElement) {
			this.elements.titleElement.textContent = meta.title || "Untitled Story";
		}
		document.title = meta.title ? `${meta.title} — Narrative Engine` : "Narrative Engine";

		this.applyEntryEffects(meta.start);
	}

	/**
	 * Restart story
	 */
	restart() {
		if (!this.story) return;
		this.resetState();
		this.render();
	}

	/**
	 * @param {string} choiceId
	 */
	handleChoice(choiceId) {
		const node = this.getCurrentNode();
		if (!node) return;
		const choice = node.choices.find((entry) => entry.id === choiceId);
		if (!choice) return;

		const requirementCheck = this.evaluateRequirements(choice);
		if (!requirementCheck.allowed) return;

		this.state.lastTestResult = null;

		// Apply base adjustments & inventory effects regardless of branching outcome.
		this.applyAdjustments(choice.adjust);
		this.applyInventoryEffects(choice.inventory);
		if (choice.log) {
			this.appendJournal(choice.log);
		}

		let nextNodeId = choice.target;

		if (choice.test) {
			const result = this.runTest(choice.test);
			this.state.lastTestResult = result;
			nextNodeId = result.success ? choice.test.success : choice.test.failure;

			// Log dice outcome for transparency.
			const labelParts = [];
			if (choice.test.stat) {
				labelParts.push(`${choice.test.stat}: ${result.statValue}`);
			}
			if (result.rollDetails.length) {
				const diceLabel = `Roll ${result.rollDetails.join(" + ")} = ${result.rollTotal}`;
				labelParts.push(diceLabel);
			}
			if (choice.test.modifier) {
				labelParts.push(`Modifier ${formatSigned(choice.test.modifier)}`);
			}
			labelParts.push(
				`Total ${result.total} ${choice.test.comparator} ${choice.test.threshold} → ${result.success ? "Success" : "Failure"
				}`
			);
			const message = `${choice.text}: ${labelParts.join(" | ")}`;
			this.appendJournal(message);
		}

		if (!nextNodeId) {
			this.state.lastTestResult = null;
			return;
		}

		this.state.history.push({
			nodeId: node.id,
			choiceId: choice.id,
			target: nextNodeId,
			timestamp: Date.now(),
		});

		this.transitionTo(nextNodeId);
	}

	/**
	 * Moves to a node and applies entry effects.
	 * @param {string} nodeId
	 */
	transitionTo(nodeId) {
		if (!this.story.nodes[nodeId]) {
			console.warn(`Node "${nodeId}" not found in story data.`);
			return;
		}

		this.state.currentNodeId = nodeId;
		this.applyEntryEffects(nodeId);
		this.render();
	}

	/**
	 * @param {string} nodeId
	 */
	applyEntryEffects(nodeId) {
		const node = this.story.nodes[nodeId];
		if (!node) return;

		this.applyAdjustments(node.entry.adjust);
		this.applyInventoryEffects(node.entry.inventory);
		node.entry.log.forEach((entry) => this.appendJournal(entry));
	}

	/**
	 * @param {Record<string, number>} adjust
	 */
	applyAdjustments(adjust) {
		if (!adjust) return;
		for (const [key, delta] of Object.entries(adjust)) {
			const current = this.state.stats[key] ?? 0;
			const next = current + delta;
			this.state.stats[key] = Number.isInteger(current) && Number.isInteger(delta) ? next : Number(next.toFixed(2));
		}
	}

	/**
	 * @param {{ add: string[], remove: string[] }} inventoryChanges
	 */
	applyInventoryEffects(inventoryChanges) {
		if (!inventoryChanges) return;
		const { add = [], remove = [] } = inventoryChanges;

		for (const item of add) {
			if (!this.state.inventory.includes(item)) {
				this.state.inventory.push(item);
			}
		}

		for (const item of remove) {
			this.state.inventory = this.state.inventory.filter((entry) => entry !== item);
		}
	}

	/**
	 * @param {string} message
	 */
	appendJournal(message) {
		if (!message) return;
		this.state.journal.push(message);
	}

	/**
	 * @returns {StoryNode|null}
	 */
	getCurrentNode() {
		if (!this.story) return null;
		return this.story.nodes[this.state.currentNodeId] ?? null;
	}

	/**
	 * @param {StoryChoice} choice
	 */
	evaluateRequirements(choice) {
		const failures = [];
		for (const requirement of choice.requires) {
			switch (requirement.type) {
				case "stat": {
					const value = this.state.stats[requirement.key] ?? 0;
					const target = Number(requirement.value);
					if (!compare(value, target, requirement.comparator)) {
						failures.push(requirement.reason || `Needs ${requirement.key} ${requirement.comparator} ${target}`);
					}
					break;
				}
				case "item": {
					if (!this.state.inventory.includes(requirement.value)) {
						failures.push(requirement.reason || `Requires ${requirement.value}`);
					}
					break;
				}
				case "flag": {
					const hasFlag = this.state.flags.has(String(requirement.value));
					const expected = requirement.comparator === "==" ? true : false;
					if (hasFlag !== expected) {
						failures.push(requirement.reason || `Requires flag ${requirement.value}`);
					}
					break;
				}
				default:
					break;
			}
		}

		return {
			allowed: failures.length === 0,
			failures,
		};
	}

	/**
	 * Executes a stat or chance test.
	 * @param {ChoiceTest} test
	 */
	runTest(test) {
		const statValue = test.stat ? this.state.stats[test.stat] ?? 0 : 0;
		const rollDetails = [];
		let rollTotal = 0;
		const dice = test.dice && test.dice.count > 0 ? test.dice : DEFAULT_DICE;

		for (let i = 0; i < dice.count; i += 1) {
			const roll = randomInt(1, dice.sides);
			rollDetails.push(roll);
			rollTotal += roll;
		}

		const total = statValue + rollTotal + (test.modifier || 0);
		const success = compare(total, test.threshold, test.comparator);
		return {
			success,
			statValue,
			rollDetails,
			rollTotal,
			total,
			test,
		};
	}

	/** Renders UI */
	render() {
		const node = this.getCurrentNode();
		if (!node) return;

		this.renderStory(node);
		this.renderStats();
		this.renderInventory();
		this.renderJournal();
		this.renderChoices(node);
		this.renderSystemMessage();
	}

	/**
	 * @param {StoryNode} node
	 */
	renderStory(node) {
		if (this.elements.nodeTitle) {
			this.elements.nodeTitle.textContent = node.title || node.id;
		}
		if (this.elements.storyText) {
			this.elements.storyText.textContent = node.text;
		}
	}

	renderStats() {
		if (!this.elements.stats) return;
		const list = this.elements.stats;
		list.innerHTML = "";
		for (const [key, value] of Object.entries(this.state.stats)) {
			const dt = document.createElement("dt");
			dt.textContent = formatLabel(key);
			const dd = document.createElement("dd");
			dd.textContent = `${value}`;
			list.append(dt, dd);
		}
	}

	renderInventory() {
		if (!this.elements.inventory) return;
		const list = this.elements.inventory;
		list.innerHTML = "";
		if (!this.state.inventory.length) {
			const placeholder = document.createElement("li");
			placeholder.textContent = "Empty";
			placeholder.className = "muted";
			list.appendChild(placeholder);
			return;
		}
		for (const item of this.state.inventory) {
			const li = document.createElement("li");
			li.textContent = item;
			list.appendChild(li);
		}
	}

	renderJournal() {
		if (!this.elements.journal) return;
		const list = this.elements.journal;
		list.innerHTML = "";
		if (!this.state.journal.length) {
			const placeholder = document.createElement("li");
			placeholder.textContent = "No entries yet.";
			placeholder.className = "muted";
			list.appendChild(placeholder);
			return;
		}
		for (const entry of this.state.journal.slice(-8)) {
			const li = document.createElement("li");
			li.textContent = entry;
			list.appendChild(li);
		}
	}

	/** @param {StoryNode} node */
	renderChoices(node) {
		const container = this.elements.choices;
		if (!container) return;
		container.innerHTML = "";

		const choices = node.choices || [];
		if (!choices.length) {
			const message = document.createElement("p");
			message.className = "muted";
			message.textContent = node.ending
				? `This path concludes with a ${node.ending} ending.`
				: "No further choices are available.";
			container.appendChild(message);
			return;
		}

		for (const choice of choices) {
			if (choice.hidden) continue;
			const { allowed, failures } = this.evaluateRequirements(choice);
			const button = document.createElement("button");
			button.type = "button";
			button.className = "choice-button";
			button.dataset.choiceId = choice.id;
			button.textContent = choice.text;
			button.disabled = !allowed;
			if (!allowed && failures.length) {
				button.title = failures.join("; ");
			}
			button.addEventListener("click", () => this.handleChoice(choice.id));
			container.appendChild(button);
		}
	}

	renderSystemMessage() {
		const container = this.elements.systemMessages;
		if (!container) return;
		container.innerHTML = "";
		const { lastTestResult } = this.state;
		if (!lastTestResult) return;

		const p = document.createElement("p");
		p.className = `roll-result ${lastTestResult.success ? "success" : "failure"}`;
		p.textContent = buildRollSummary(lastTestResult);
		container.appendChild(p);
	}
}

function buildRollSummary(result) {
	const parts = [];
	if (result.test.stat) {
		parts.push(`${formatLabel(result.test.stat)} ${result.statValue}`);
	}
	if (result.rollDetails.length) {
		parts.push(
			`${result.rollDetails.length}d${result.test.dice?.sides || DEFAULT_DICE.sides} → ${result.rollDetails.join(
				", "
			)}`
		);
	}
	if (result.test.modifier) {
		parts.push(`Modifier ${formatSigned(result.test.modifier)}`);
	}
	parts.push(
		`Total ${result.total} ${result.test.comparator} ${result.test.threshold} → ${result.success ? "Success" : "Failure"
		}`
	);
	return parts.join(" | ");
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function compare(lhs, rhs, comparator) {
	switch (comparator) {
		case ">=":
			return lhs >= rhs;
		case ">":
			return lhs > rhs;
		case "<=":
			return lhs <= rhs;
		case "<":
			return lhs < rhs;
		case "==":
			return lhs === rhs;
		case "!=":
			return lhs !== rhs;
		default:
			return false;
	}
}

function formatLabel(value) {
	return value
		.split(/[_\s-]+/)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

function formatSigned(value) {
	return value >= 0 ? `+${value}` : `${value}`;
}

