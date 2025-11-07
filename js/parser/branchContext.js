import { parseBracketValue } from "./valueParser.js";

/**
 * @returns {import("./types.js").ParseContext}
 */
export function createParseContext() {
	return {
		current: null,
		descriptionActive: false,
		branches: [],
	};
}

/**
 * @param {string} title
 * @returns {import("./types.js").BranchParseContext}
 */
export function createBranchContext(title) {
	return {
		id: null,
		title,
		descriptionLines: [],
		choices: [],
	};
}

/**
 * Pushes the active branch onto the context list.
 * @param {import("./types.js").ParseContext} context
 */
export function finalizeBranch(context) {
	if (!context.current) return;

	if (!context.current.id) {
		throw new Error(`Branch "${context.current.title}" is missing its Branch number.`);
	}

	context.branches.push(context.current);
	context.current = null;
	context.descriptionActive = false;
}

/**
 * Extracts the value portion from a directive line (e.g., "Title: Intro").
 * @param {string} raw
 * @param {string} label
 * @param {number} lineIndex
 * @returns {string}
 */
export function extractDirectiveValue(raw, label, lineIndex, options = {}) {
	const { allowEmpty = false } = options;
	const delimiter = raw.indexOf(":");
	if (delimiter === -1) {
		throw new Error(`${label} definition on line ${lineIndex + 1} is missing ":".`);
	}
	const value = raw.slice(delimiter + 1).trim();
	if (!allowEmpty && !value) {
		throw new Error(`${label} definition on line ${lineIndex + 1} is missing its value.`);
	}
	return value;
}

/**
 * Normalises branch ids, removing optional brackets.
 * @param {string} input
 * @returns {string}
 */
export function normalizeBranchId(input) {
	const value = parseBracketValue(input);
	if (!value) {
		throw new Error("Branch number cannot be empty.");
	}
	return value;
}
