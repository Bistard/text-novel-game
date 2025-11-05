import { parseBracketValue } from "./valueParser.js";

/**
 * Parses roll directives like "stat=[strength], dice=2d6, target=12, ok=[path-a], fail=[path-b]".
 * @param {string} raw
 * @param {number} lineNumber
 * @returns {import("./types.js").RollDirective}
 */
export function parseRollEffect(raw, lineNumber) {
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
		throw new Error(`Dice definition "${raw}" on line ${lineNumber} must be like "6" or "2d6" (count optional).`);
	}

	const count = match[1] ? Number(match[1]) : 1;
	const sides = Number(match[2]);
	if (Number.isNaN(count) || Number.isNaN(sides) || count <= 0 || sides <= 0) {
		throw new Error(`Dice definition "${raw}" on line ${lineNumber} must contain positive integers.`);
	}

	return { count, sides };
}
