const COMMENT_PREFIX = "#";

/**
 * Parses the custom branch-based story format into structured data.
 * Each branch must start with a Title line, followed by its Branch number,
 * description, and one or more Choice lines.
 *
 * @param {string} raw
 * @returns {{ start: string, branches: Record<string, StoryBranch> }}
 */
export function parseStory(raw) {
	if (typeof raw !== "string") {
		throw new TypeError("Story parser expected a string payload.");
	}

	const lines = raw.split(/\r?\n/);
	const context = {
		current: null,
		descriptionActive: false,
		branches: [],
	};

	for (let index = 0; index <= lines.length; index += 1) {
		const rawLine = index < lines.length ? lines[index] : null;

		if (rawLine === null) {
			finalizeBranch(context);
			break;
		}

		const trimmed = rawLine.trim();

		// Preserve blank lines inside the description block.
		if (!trimmed) {
			if (context.current && context.descriptionActive) {
				context.current.descriptionLines.push("");
			}
			continue;
		}

		if (trimmed.startsWith(COMMENT_PREFIX)) {
			continue;
		}

		const lower = trimmed.toLowerCase();

		if (lower.startsWith("title:")) {
			finalizeBranch(context);
			context.current = createBranchContext(extractValue(rawLine, "Title", index));
			context.descriptionActive = false;
			continue;
		}

		if (!context.current) {
			throw new Error(
				`Unexpected content before the first branch on line ${index + 1}. Start branches with "Title:".`
			);
		}

		if (lower.startsWith("branch:")) {
			context.current.id = normalizeBranchId(extractValue(rawLine, "Branch", index));
			context.descriptionActive = false;
			continue;
		}

		if (lower.startsWith("description:")) {
			const firstLine = extractValue(rawLine, "Description", index);
			context.current.descriptionLines = [firstLine];
			context.descriptionActive = true;
			continue;
		}

		if (lower.startsWith("choice:")) {
			const payload = rawLine.slice(rawLine.indexOf(":") + 1).trim();
			if (!payload) {
				throw new Error(`Choice definition on line ${index + 1} is missing content.`);
			}
			context.current.choices.push(parseChoice(context.current.id, payload, index + 1));
			context.descriptionActive = false;
			continue;
		}

		if (context.descriptionActive) {
			context.current.descriptionLines.push(rawLine.trim());
			continue;
		}

		throw new Error(`Unrecognised directive on line ${index + 1}: "${rawLine}".`);
	}

	if (!context.branches.length) {
		throw new Error("No branches were discovered in the story file.");
	}

	const branchMap = {};
	let startId = null;

	for (const branchContext of context.branches) {
		if (branchMap[branchContext.id]) {
			throw new Error(`Duplicate branch id "${branchContext.id}" encountered.`);
		}

		const description = branchContext.descriptionLines.join("\n").trim();
		if (!description) {
			throw new Error(`Branch "${branchContext.id}" is missing a description.`);
		}

		const branch = {
			id: branchContext.id,
			title: branchContext.title,
			description,
			choices: branchContext.choices.map((choice, idx) => ({
				id: `${branchContext.id}:${idx + 1}`,
				text: choice.text,
				next: choice.next,
				stats: choice.stats,
				inventory: choice.inventory,
				roll: choice.roll,
			})),
		};

		branchMap[branch.id] = branch;
		if (!startId) {
			startId = branch.id;
		}
	}

	return { start: startId, branches: branchMap };
}

/**
 * @param {string} title
 * @returns {BranchParseContext}
 */
function createBranchContext(title) {
	return {
		id: null,
		title,
		descriptionLines: [],
		choices: [],
	};
}

/**
 * @param {ParseContext} context
 */
function finalizeBranch(context) {
	if (!context.current) return;

	if (!context.current.id) {
		throw new Error(`Branch "${context.current.title}" is missing its Branch number.`);
	}

	context.branches.push(context.current);
	context.current = null;
	context.descriptionActive = false;
}

/**
 * @param {string} raw
 * @param {string} label
 * @param {number} lineIndex
 */
function extractValue(raw, label, lineIndex) {
	const delimiter = raw.indexOf(":");
	if (delimiter === -1) {
		throw new Error(`${label} definition on line ${lineIndex + 1} is missing ":".`);
	}
	const value = raw.slice(delimiter + 1).trim();
	if (!value) {
		throw new Error(`${label} definition on line ${lineIndex + 1} is missing its value.`);
	}
	return value;
}

/**
 * @param {string} input
 */
function normalizeBranchId(input) {
	const value = parseBracketValue(input);
	if (!value) {
		throw new Error("Branch number cannot be empty.");
	}
	return value;
}

/**
 * @param {string} branchId
 * @param {string} payload
 * @param {number} lineNumber 1-indexed
 * @returns {StoryChoiceDraft}
 */
function parseChoice(branchId, payload, lineNumber) {
	const segments = payload
		.split(";")
		.map((token) => token.trim())
		.filter(Boolean);

	if (!segments.length) {
		throw new Error(`Choice on line ${lineNumber} has no directives.`);
	}

	const choice = {
		text: "",
		next: null,
		stats: [],
		inventory: [],
		roll: null,
	};

	for (const segment of segments) {
		const delimiter = segment.indexOf("=");
		if (delimiter === -1) {
			throw new Error(`Malformed directive "${segment}" on line ${lineNumber}.`);
		}

		const left = segment.slice(0, delimiter).trim();
		const rightRaw = segment.slice(delimiter + 1).trim();
		if (!left || rightRaw == null) {
			throw new Error(`Malformed directive "${segment}" on line ${lineNumber}.`);
		}

		const key = left.toLowerCase();
		const value = parseBracketValue(rightRaw);

		switch (key) {
			case "display":
				if (choice.text) {
					throw new Error(`Choice on line ${lineNumber} defines "display" more than once.`);
				}
				choice.text = value;
				break;
			case "next":
				if (choice.next) {
					throw new Error(`Choice on line ${lineNumber} defines "next" more than once.`);
				}
				choice.next = value;
				break;
			case "item":
				choice.inventory.push(parseItemEffect(value, lineNumber));
				break;
			case "stat":
				choice.stats.push(parseStatEffect(value, lineNumber));
				break;
			case "roll":
				if (choice.roll) {
					throw new Error(`Choice on line ${lineNumber} includes multiple roll directives.`);
				}
				choice.roll = parseRollEffect(value, lineNumber);
				break;
			default:
				throw new Error(`Unsupported directive "${segment}" on line ${lineNumber}.`);
		}
	}

	if (!choice.text) {
		throw new Error(`Choice on line ${lineNumber} is missing its display text.`);
	}

	if (!choice.next && !choice.roll) {
		throw new Error(
			`Choice "${choice.text}" in branch "${branchId}" needs either a next branch or a roll outcome.`
		);
	}

	return choice;
}

/**
 * Converts bracket-wrapped values into plain strings (e.g., "[north]" -> "north").
 * @param {string} raw
 */
function parseBracketValue(raw) {
	const trimmed = raw.trim();
	if (!trimmed) return "";
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

/**
 * @param {string} raw
 * @param {number} lineNumber
 * @returns {{ item: string, delta: number }}
 */
function parseItemEffect(raw, lineNumber) {
	const match = raw.match(/^(.+?)([+-])(\d+)?$/);
	if (!match) {
		throw new Error(`Item effect "${raw}" on line ${lineNumber} must end with + or - (optionally with a count).`);
	}
	const item = match[1].trim();
	if (!item) {
		throw new Error(`Item effect on line ${lineNumber} is missing the item name.`);
	}
	const sign = match[2] === "+" ? 1 : -1;
	const quantity = match[3] ? Number(match[3]) : 1;
	if (Number.isNaN(quantity) || quantity <= 0) {
		throw new Error(`Item effect "${raw}" on line ${lineNumber} must use a positive quantity.`);
	}
	return { item, delta: sign * quantity };
}

/**
 * @param {string} raw
 * @param {number} lineNumber
 * @returns {{ stat: string, delta: number }}
 */
function parseStatEffect(raw, lineNumber) {
	const match = raw.match(/^(.+?)([+-])([\d.]+)$/);
	if (!match) {
		throw new Error(
			`Stat effect "${raw}" on line ${lineNumber} must follow the pattern statName+/-Number (e.g., strength+1).`
		);
	}
	const stat = match[1].trim();
	if (!stat) {
		throw new Error(`Stat effect on line ${lineNumber} is missing the stat name.`);
	}

	const sign = match[2] === "+" ? 1 : -1;
	const amount = Number(match[3]);
	if (Number.isNaN(amount)) {
		throw new Error(`Stat effect "${raw}" on line ${lineNumber} uses an invalid amount.`);
	}

	return { stat, delta: sign * amount };
}

/**
 * @param {string} raw
 * @param {number} lineNumber
 * @returns {RollDirective}
 */
function parseRollEffect(raw, lineNumber) {
	const tokens = raw
		.split(",")
		.map((token) => token.trim())
		.filter(Boolean);

	if (!tokens.length) {
		throw new Error(`Roll effect on line ${lineNumber} is empty.`);
	}

	const directive = {
		stat: null,
		dice: { count: 1, sides: 6 },
		target: null,
		ok: null,
		fail: null,
	};

	for (const token of tokens) {
		if (!token.includes("=")) {
			const label = parseBracketValue(token);
			if (!label || label.toLowerCase() === "none") {
				directive.stat = null;
			} else if (directive.stat && directive.stat !== label) {
				throw new Error(
					`Roll on line ${lineNumber} defines conflicting stat labels ("${directive.stat}" vs "${label}").`
				);
			} else {
				directive.stat = label;
			}
			continue;
		}

		const eqIndex = token.indexOf("=");
		if (eqIndex === -1) {
			throw new Error(`Malformed roll token "${token}" on line ${lineNumber}.`);
		}

		const keyRaw = token.slice(0, eqIndex).trim();
		const valueRaw = token.slice(eqIndex + 1).trim();
		if (!keyRaw || valueRaw == null) {
			throw new Error(`Malformed roll token "${token}" on line ${lineNumber}.`);
		}

		const key = keyRaw.toLowerCase();
		const value = parseBracketValue(valueRaw);

		switch (key) {
			case "roll":
			case "stat":
				directive.stat = value && value.toLowerCase() !== "none" ? value : null;
				break;
			case "dice":
				directive.dice = parseDice(value, lineNumber);
				break;
			case "target": {
				const target = Number(value);
				if (Number.isNaN(target)) {
					throw new Error(`Roll target "${value}" on line ${lineNumber} must be a number.`);
				}
				directive.target = target;
				break;
			}
			case "ok":
				directive.ok = value;
				break;
			case "fail":
				directive.fail = value;
				break;
			default:
				throw new Error(`Unknown roll token "${token}" on line ${lineNumber}.`);
		}
	}

	if (directive.target == null) {
		throw new Error(`Roll on line ${lineNumber} is missing its target value.`);
	}
	if (!directive.ok || !directive.fail) {
		throw new Error(`Roll on line ${lineNumber} requires both ok and fail branches.`);
	}

	return directive;
}

/**
 * @param {string} raw
 * @param {number} lineNumber
 */
function parseDice(raw, lineNumber) {
	const match = raw.toLowerCase().match(/^(?:(\d+)\s*d)?\s*(\d+)$/);
	if (!match) {
		throw new Error(
			`Dice definition "${raw}" on line ${lineNumber} must be like "6" or "2d6" (count optional).`
		);
	}

	const count = match[1] ? Number(match[1]) : 1;
	const sides = Number(match[2]);
	if (Number.isNaN(count) || Number.isNaN(sides) || count <= 0 || sides <= 0) {
		throw new Error(`Dice definition "${raw}" on line ${lineNumber} must contain positive integers.`);
	}

	return { count, sides };
}

/**
 * @typedef {Object} ParseContext
 * @property {BranchParseContext|null} current
 * @property {boolean} descriptionActive
 * @property {BranchParseContext[]} branches
 */

/**
 * @typedef {Object} BranchParseContext
 * @property {string|null} id
 * @property {string} title
 * @property {string[]} descriptionLines
 * @property {StoryChoiceDraft[]} choices
 */

/**
 * @typedef {Object} StoryBranch
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {StoryChoice[]} choices
 */

/**
 * @typedef {Object} StoryChoiceDraft
 * @property {string} text
 * @property {string|null} next
 * @property {{ stat: string, delta: number }[]} stats
 * @property {{ item: string, delta: number }[]} inventory
 * @property {RollDirective|null} roll
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
