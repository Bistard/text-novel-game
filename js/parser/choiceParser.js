import { parseBracketValue } from "./valueParser.js";
import { parseItemEffect, parseStatEffect } from "./effectsParser.js";
import { parseRollEffect } from "./rollParser.js";
import { parseCondition } from "./conditionParser.js";

/**
 * @param {string} branchId
 * @param {string} payload
 * @param {number} lineNumber
 * @returns {import("./types.js").StoryChoiceDraft}
 */
export function parseChoice(branchId, payload, lineNumber) {
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
		visibilityCondition: null,
		validCondition: null,
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
			case "optional":
				if (choice.visibilityCondition) {
					throw new Error(`Choice on line ${lineNumber} defines "optional" more than once.`);
				}
				choice.visibilityCondition = parseCondition(value, lineNumber, "optional");
				break;
			case "valid":
				if (choice.validCondition) {
					throw new Error(`Choice on line ${lineNumber} defines "valid" more than once.`);
				}
				choice.validCondition = parseCondition(value, lineNumber, "valid");
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
