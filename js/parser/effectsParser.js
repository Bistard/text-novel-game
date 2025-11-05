/**
 * Parses inventory change directives like "rope+1" or "key-1".
 * @param {string} raw
 * @param {number} lineNumber
 * @returns {{ item: string, delta: number }}
 */
export function parseItemEffect(raw, lineNumber) {
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
 * Parses stat directives like "strength+1" or "luck-(roll)".
 * @param {string} raw
 * @param {number} lineNumber
 * @returns {{ stat: string, delta: number, dynamic?: { type: "roll-total"|"roll-dice"|"roll-stat", scale: number, token?: string } }}
 */
export function parseStatEffect(raw, lineNumber) {
	const match = raw.match(/^(.+?)([+-])(.+)$/);
	if (!match) {
		throw new Error(
			`Stat effect "${raw}" on line ${lineNumber} must follow the pattern statName+/-value (e.g., strength+1).`
		);
	}
	const stat = match[1].trim();
	if (!stat) {
		throw new Error(`Stat effect on line ${lineNumber} is missing the stat name.`);
	}

	const sign = match[2] === "+" ? 1 : -1;
	const amountToken = match[3].trim();
	if (!amountToken) {
		throw new Error(`Stat effect "${raw}" on line ${lineNumber} uses an invalid amount.`);
	}

	const cleanedToken = amountToken.replace(/^\((.*)\)$/, "$1").trim();
	const numericAmount = Number(cleanedToken);
	if (!Number.isNaN(numericAmount)) {
		return { stat, delta: sign * numericAmount };
	}

	const dynamicType = mapDynamicStatToken(cleanedToken.toLowerCase());
	if (!dynamicType) {
		throw new Error(
			`Stat effect "${raw}" on line ${lineNumber} uses an unsupported dynamic value "${cleanedToken}".`
		);
	}

	return {
		stat,
		delta: 0,
		dynamic: {
			type: dynamicType,
			scale: sign,
			token: cleanedToken,
		},
	};
}

function mapDynamicStatToken(token) {
	const normalized = token.replace(/[\s_-]+/g, "");
	switch (normalized) {
		case "roll":
		case "result":
		case "total":
		case "rolltotal":
		case "x":
		case "value":
			return "roll-total";
		case "rolldice":
		case "dice":
		case "dicetotal":
			return "roll-dice";
		case "rollstat":
		case "stat":
		case "modifier":
			return "roll-stat";
		default:
			return null;
	}
}
