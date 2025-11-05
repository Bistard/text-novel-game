/**
 * Adds the branch id to the visited set.
 * @param {Set<string>} visited
 * @param {string} branchId
 */
export function markVisited(visited, branchId) {
	if (!visited || !(visited instanceof Set)) {
		return;
	}
	if (typeof branchId !== "string") {
		return;
	}
	const id = branchId.trim();
	if (id) {
		visited.add(id);
	}
}

/**
 * Checks if the branch has been visited.
 * @param {Set<string>} visited
 * @param {string} branchId
 * @returns {boolean}
 */
export function hasVisited(visited, branchId) {
	if (!visited || !(visited instanceof Set)) {
		return false;
	}
	if (typeof branchId !== "string") {
		return false;
	}
	const id = branchId.trim();
	if (!id) {
		return false;
	}
	return visited.has(id);
}

/**
 * Returns a serialisable list of visited branches.
 * @param {Set<string>} visited
 * @returns {string[]}
 */
export function snapshotVisited(visited) {
	if (!visited || !(visited instanceof Set)) {
		return [];
	}
	return Array.from(visited);
}

/**
 * Restores a visited set from a snapshot payload.
 * @param {unknown[]} entries
 * @returns {Set<string>}
 */
export function restoreVisited(entries) {
	const visited = new Set();
	if (!Array.isArray(entries)) {
		return visited;
	}
	for (const entry of entries) {
		if (typeof entry !== "string") continue;
		const id = entry.trim();
		if (id) {
			visited.add(id);
		}
	}
	return visited;
}
