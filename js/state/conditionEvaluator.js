import { hasVisited } from "./visitTracker.js";
import { hasInventoryItem } from "./inventoryManager.js";

/**
 * Evaluates a condition definition against the provided state fragments.
 * @param {import("../parser/types.js").ConditionDefinition|null|undefined} condition
 * @param {{ visited: Set<string>, inventory: Record<string, number> }} subject
 * @returns {boolean}
 */
export function evaluateCondition(condition, subject) {
	if (!condition) {
		return true;
	}

	const values = Array.isArray(condition.values)
		? condition.values.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)
		: [];

	if (!values.length) {
		return false;
	}

	switch (condition.kind) {
		case "visited-all":
			return values.every((id) => hasVisited(subject.visited, id));
		case "visited-any":
			return values.some((id) => hasVisited(subject.visited, id));
		case "visited-none":
			return values.every((id) => !hasVisited(subject.visited, id));
		case "inventory-all":
			return values.every((item) => hasInventoryItem(subject.inventory, item));
		case "inventory-any":
			return values.some((item) => hasInventoryItem(subject.inventory, item));
		default:
			return false;
	}
}
