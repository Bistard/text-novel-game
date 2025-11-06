const DELIMITER = ">>>";

/**
 * Adds a transition key to the set.
 * @param {Set<string>} transitions
 * @param {string} fromId
 * @param {string} toId
 */
export function markTransition(transitions, fromId, toId) {
	if (!transitions || !(transitions instanceof Set)) {
		return;
	}
	if (typeof fromId !== "string" || typeof toId !== "string") {
		return;
	}
	const from = fromId.trim();
	const to = toId.trim();
	if (!from || !to) {
		return;
	}
	transitions.add(createKey(from, to));
}

/**
 * @param {Set<string>} transitions
 * @returns {{ from: string, to: string }[]}
 */
export function snapshotTransitions(transitions) {
	if (!transitions || !(transitions instanceof Set)) {
		return [];
	}
	const result = [];
	for (const entry of transitions) {
		const parsed = parseKey(entry);
		if (parsed) {
			result.push(parsed);
		}
	}
	return result;
}

/**
 * Restores a transition set from serialisable entries.
 * @param {{ from?: string, to?: string }[]|string[]} entries
 * @returns {Set<string>}
 */
export function restoreTransitions(entries) {
	const restored = new Set();
	if (!Array.isArray(entries)) {
		return restored;
	}
	for (const entry of entries) {
		if (typeof entry === "string") {
			const parsed = parseKey(entry);
			if (parsed) {
				restored.add(createKey(parsed.from, parsed.to));
			}
			continue;
		}
		if (!entry || typeof entry !== "object") {
			continue;
		}
		const from = typeof entry.from === "string" ? entry.from.trim() : "";
		const to = typeof entry.to === "string" ? entry.to.trim() : "";
		if (!from || !to) {
			continue;
		}
		restored.add(createKey(from, to));
	}
	return restored;
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
export function createKey(from, to) {
	return `${from}${DELIMITER}${to}`;
}

/**
 * @param {string} key
 * @returns {{ from: string, to: string }|null}
 */
export function parseKey(key) {
	if (typeof key !== "string") {
		return null;
	}
	const index = key.indexOf(DELIMITER);
	if (index === -1) {
		return null;
	}
	const from = key.slice(0, index).trim();
	const to = key.slice(index + DELIMITER.length).trim();
	if (!from || !to) {
		return null;
	}
	return { from, to };
}
