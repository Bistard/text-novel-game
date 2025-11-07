import { t } from "./i18n/index.js";

/**
 * Breaks a raw description into clean paragraphs.
 * @param {string} text
 * @returns {string[]}
 */
export function chunkParagraphs(text) {
	if (!text) return [];
	const lines = text.split(/\n/);
	const paragraphs = [];
	let buffer = [];

	const flush = () => {
		if (!buffer.length) return;
		const paragraph = buffer.join(" ").trim();
		if (paragraph) {
			paragraphs.push(paragraph);
		}
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
	return paragraphs;
}

/**
 * Converts a snake/dash/space separated label into Title Case.
 * @param {string} value
 * @returns {string}
 */
export function formatLabel(value) {
	return value
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

/**
 * Prepends a + sign for positive numbers.
 * @param {number} value
 * @returns {string}
 */
export function formatSigned(value) {
	return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * Builds a human-readable summary of the most recent roll.
 * @param {RollResult} result
 * @returns {string}
 */
export function buildRollSummary(result) {
	const parts = [];
	if (result.directive.stat) {
		parts.push(`${formatLabel(result.directive.stat)} ${formatSigned(result.statValue)}`);
	}
	if (result.rolls.length) {
		const diceLabel =
			result.directive.dice.count === 1
				? `d${result.directive.dice.sides}`
				: `${result.directive.dice.count}d${result.directive.dice.sides}`;
		const rolls = result.rolls.join(", ");
		parts.push(t("roll.summaryDice", { dice: diceLabel, rolls }));
	}
	if (result.directive.target != null) {
		parts.push(t("roll.summaryTotal", { total: result.total, target: result.directive.target }));
	} else {
		parts.push(t("roll.summaryTotalNoTarget", { total: result.total }));
	}
	parts.push(result.success ? t("common.success") : t("common.failure"));
	return parts.join(" | ");
}

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
