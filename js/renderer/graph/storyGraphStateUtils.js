import { createKey as createTransitionKey, parseKey as parseTransitionKey } from "../../state/transitionTracker.js";

export function buildVisitedSet(state) {
	const visited = new Set();
	if (!state || typeof state.getVisitedBranches !== "function") {
		return visited;
	}
	for (const id of state.getVisitedBranches()) {
		if (typeof id === "string" && id.trim()) {
			visited.add(id.trim());
		}
	}
	return visited;
}

export function buildVisitedTransitionSet(state) {
	const transitions = new Set();
	if (!state || typeof state.getVisitedTransitions !== "function") {
		return transitions;
	}
	const entries = state.getVisitedTransitions();
	if (!Array.isArray(entries)) {
		return transitions;
	}
	for (const entry of entries) {
		if (typeof entry === "string") {
			const parsed = parseTransitionKey(entry);
			if (parsed) {
				transitions.add(createTransitionKey(parsed.from, parsed.to));
			}
			continue;
		}
		if (!entry || typeof entry !== "object") continue;
		const from = typeof entry.from === "string" ? entry.from.trim() : "";
		const to = typeof entry.to === "string" ? entry.to.trim() : "";
		if (!from || !to) continue;
		transitions.add(createTransitionKey(from, to));
	}
	return transitions;
}

export function filterVisitedNodes(nodes, visited) {
	const filtered = [];
	for (const node of nodes) {
		if (visited.has(node.id)) {
			filtered.push(node);
		}
	}
	return filtered;
}
