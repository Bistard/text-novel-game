/**
 * Parses condition directives used by choices.
 * @param {string} raw
 * @param {number} lineNumber
 * @param {"optional"|"valid"} directive
 * @returns {import("./types.js").ConditionDefinition}
 */
export function parseCondition(raw, lineNumber, directive) {
	const value = typeof raw === "string" ? raw.trim() : "";
	if (!value) {
		throw new Error(`Choice on line ${lineNumber} is missing a value for "${directive}".`);
	}

	const match = value.match(/^([a-z][\w-]*)\s*\((.*)\)$/i);
	if (!match) {
		throw new Error(
			`Condition "${value}" on line ${lineNumber} must follow the pattern name(arg1, arg2, ...).`
		);
	}

	const keyword = match[1].toLowerCase();
	const argumentSection = match[2] != null ? match[2].trim() : "";
	const tokens = argumentSection
		.split(",")
		.map((token) => token.trim())
		.filter(Boolean);
	if (!tokens.length) {
		throw new Error(`Condition "${value}" on line ${lineNumber} must include at least one argument.`);
	}

	switch (keyword) {
		case "visited":
		case "visitedall":
		case "visited-all":
		case "visited_all":
			return { kind: "visited-all", values: tokens, raw: value };
		case "visitedany":
		case "visited-any":
		case "visited_any":
			return { kind: "visited-any", values: tokens, raw: value };
		case "has":
		case "hasall":
		case "inventory":
		case "inventoryall":
		case "inventory-all":
		case "inventory_all":
			return { kind: "inventory-all", values: tokens, raw: value };
		case "hasany":
		case "has-any":
		case "has_any":
		case "inventoryany":
		case "inventory-any":
		case "inventory_any":
			return { kind: "inventory-any", values: tokens, raw: value };
		default:
			throw new Error(`Unknown condition "${keyword}" on line ${lineNumber}.`);
	}
}
