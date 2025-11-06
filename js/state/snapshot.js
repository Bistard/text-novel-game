import { normaliseJournal } from "./journalManager.js";
import { snapshotVisited, restoreVisited } from "./visitTracker.js";
import { snapshotTransitions, restoreTransitions } from "./transitionTracker.js";

/**
 * Creates a serialisable snapshot of the state.
 * @param {{ branchId: string|null, stats: Record<string, number>, inventory: Record<string, number>, journal: string[], visited: Set<string>, transitions: Set<string> }} state
 * @returns {{ currentBranchId: string|null, stats: Record<string, number>, inventory: Record<string, number>, journal: string[], visitedBranches: string[], visitedTransitions: { from: string, to: string }[] }}
 */
export function createSnapshot(state) {
	return {
		currentBranchId: state.branchId || null,
		stats: { ...state.stats },
		inventory: { ...state.inventory },
		journal: Array.isArray(state.journal) ? state.journal.slice() : [],
		visitedBranches: snapshotVisited(state.visited),
		visitedTransitions: snapshotTransitions(state.transitions),
	};
}

/**
 * Normalises snapshot payload into clean state fragments.
 * @param {unknown} snapshot
 * @param {{ statsManager: import("./statsManager.js").StatsManager, maxJournalEntries: number }} options
 * @returns {{ stats: Record<string, number>, inventory: Record<string, number>, journal: string[], visited: Set<string>, transitions: Set<string>, branchId: string|null }}
 */
export function restoreFromSnapshot(snapshot, { statsManager, maxJournalEntries }) {
	if (!snapshot || typeof snapshot !== "object") {
		throw new Error("Invalid save snapshot payload.");
	}

	const stats = statsManager.cloneDefaults();
	if (snapshot.stats && typeof snapshot.stats === "object") {
		for (const [name, value] of Object.entries(snapshot.stats)) {
			if (typeof name !== "string") continue;
			const key = name.trim().toLowerCase();
			if (!key) continue;
			if (!Object.prototype.hasOwnProperty.call(stats, key)) {
				continue;
			}
			const numericValue = Number(value);
			stats[key] = Number.isFinite(numericValue) ? numericValue : stats[key];
		}
	}

	const inventory = {};
	if (snapshot.inventory && typeof snapshot.inventory === "object") {
		for (const [item, rawValue] of Object.entries(snapshot.inventory)) {
			if (typeof item !== "string") continue;
			const name = item.trim();
			if (!name) continue;
			const value = Number(rawValue);
			if (Number.isFinite(value) && value > 0) {
				inventory[name] = value;
			}
		}
	}

	const journal = normaliseJournal(snapshot.journal, maxJournalEntries);
	const visited = restoreVisited(snapshot.visitedBranches);

	const branchId =
		typeof snapshot.currentBranchId === "string" && snapshot.currentBranchId.trim()
			? snapshot.currentBranchId.trim()
			: null;

	const transitions = restoreTransitions(snapshot.visitedTransitions);

	return { stats, inventory, journal, visited, transitions, branchId };
}
