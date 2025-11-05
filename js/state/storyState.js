import { StatsManager } from "./statsManager.js";
import { hasInventoryItem, applyInventoryEffects } from "./inventoryManager.js";
import { appendJournal } from "./journalManager.js";
import { evaluateCondition as evaluateConditionDefinition } from "./conditionEvaluator.js";
import { markVisited, hasVisited, snapshotVisited } from "./visitTracker.js";
import { createSnapshot, restoreFromSnapshot } from "./snapshot.js";

const DEFAULT_MAX_JOURNAL_ENTRIES = 8;

/**
 * Holds mutable game state (stats, inventory, journal, etc).
 */
export class StoryState {
	/**
	 * @param {number} [maxJournalEntries]
	 */
	constructor(maxJournalEntries = DEFAULT_MAX_JOURNAL_ENTRIES) {
		this.maxJournalEntries = maxJournalEntries;
		this.statsManager = new StatsManager();
		this.reset();
	}

	/**
	 * Resets to defaults and sets the starting branch if provided.
	 * @param {string|null} [startBranchId]
	 */
	reset(startBranchId = null) {
		this.stats = this.statsManager.cloneDefaults();
		this.inventory = {};
		this.journal = [];
		this.lastRoll = null;
		this.systemError = null;
		this.visitedBranches = new Set();
		this.currentBranchId = null;
		if (startBranchId) {
			this.setCurrentBranch(startBranchId);
		}
	}

	/**
	 * Sets the allowed stats and their default values.
	 * @param {Record<string, number>} defaults
	 */
	configureStats(defaults = {}) {
		this.statsManager.configure(defaults);
		this.stats = this.statsManager.cloneDefaults();
	}

	/**
	 * @returns {string|null}
	 */
	getCurrentBranchId() {
		return this.currentBranchId || null;
	}

	/**
	 * @param {string} branchId
	 */
	setCurrentBranch(branchId) {
		if (typeof branchId === "string") {
			const normalized = branchId.trim();
			if (normalized) {
				this.currentBranchId = normalized;
				this.markBranchVisited(normalized);
				return;
			}
		}
		this.currentBranchId = null;
	}

	/**
	 * Marks a branch as visited.
	 * @param {string} branchId
	 */
	markBranchVisited(branchId) {
		if (!this.visitedBranches || !(this.visitedBranches instanceof Set)) {
			this.visitedBranches = new Set();
		}
		markVisited(this.visitedBranches, branchId);
	}

	/**
	 * Checks whether a branch has been visited by the player.
	 * @param {string} branchId
	 */
	hasVisitedBranch(branchId) {
		return hasVisited(this.visitedBranches, branchId);
	}

	/**
	 * Returns an array snapshot of visited branches.
	 * @returns {string[]}
	 */
	getVisitedBranches() {
		return snapshotVisited(this.visitedBranches);
	}

	/**
	 * Checks whether the inventory currently contains an item.
	 * @param {string} itemName
	 * @returns {boolean}
	 */
	hasInventoryItem(itemName) {
		return hasInventoryItem(this.inventory, itemName);
	}

	/**
	 * Evaluates a condition against the current state.
	 * @param {import("../parser/types.js").ConditionDefinition|null|undefined} condition
	 * @returns {boolean}
	 */
	evaluateCondition(condition) {
		return evaluateConditionDefinition(condition, {
			visited: this.visitedBranches,
			inventory: this.inventory,
		});
	}

	/**
	 * Splits stat effects into recognised and unknown collections.
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[]} effects
	 * @returns {{ allowed: { stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[], unknown: string[] }}
	 */
	partitionStatEffects(effects) {
		return this.statsManager.partitionEffects(effects);
	}

	/**
	 * Evaluates and applies stat effects.
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[]} effects
	 * @param {{ rollResult?: import("../storyUtilities.js").RollResult|null }} [context]
	 * @returns {{ applied: { stat: string, delta: number }[], issues: string[] }}
	 */
	applyStatEffects(effects, context = {}) {
		return this.statsManager.applyEffects(this.stats, effects, context, this.lastRoll);
	}

	/**
	 * Computes the numeric deltas for the provided effects without mutating state.
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[]} effects
	 * @param {{ rollResult?: import("../storyUtilities.js").RollResult|null }} [context]
	 * @returns {{ evaluated: { stat: string, delta: number, label?: string }[], issues: string[] }}
	 */
	evaluateStatEffects(effects, context = {}) {
		return this.statsManager.evaluateEffects(effects, context, this.lastRoll);
	}

	/**
	 * Applies already evaluated stat effects to the state.
	 * @param {{ stat: string, delta: number }[]} effects
	 * @returns {{ stat: string, delta: number }[]}
	 */
	applyEvaluatedStatEffects(effects) {
		return this.statsManager.applyEvaluatedEffects(this.stats, effects);
	}

	/**
	 * @param {{ item: string, delta: number }[]} effects
	 * @returns {{ item: string, delta: number }[]}
	 */
	applyInventoryEffects(effects) {
		return applyInventoryEffects(this.inventory, effects);
	}

	/**
	 * @param {string} text
	 */
	appendJournal(text) {
		appendJournal(this.journal, text, this.maxJournalEntries);
	}

	/**
	 * @param {string} stat
	 * @returns {number}
	 */
	getStatValue(stat) {
		return this.statsManager.getValue(this.stats, stat);
	}

	/**
	 * @param {import("../storyUtilities.js").RollResult|null} roll
	 */
	setLastRoll(roll) {
		this.lastRoll = roll;
	}

	clearLastRoll() {
		this.lastRoll = null;
	}

	/**
	 * @param {string|null} message
	 */
	setSystemError(message) {
		this.systemError = message || null;
	}

	clearSystemError() {
		this.systemError = null;
	}

	/**
	 * Creates a serialisable snapshot of the current game state.
	 * @returns {{ currentBranchId: string|null, stats: Record<string, number>, inventory: Record<string, number>, journal: string[], visitedBranches: string[] }}
	 */
	createSnapshot() {
		return createSnapshot({
			branchId: this.getCurrentBranchId(),
			stats: this.stats,
			inventory: this.inventory,
			journal: this.journal,
			visited: this.visitedBranches,
		});
	}

	/**
	 * Restores state from a previously created snapshot.
	 * @param {{ currentBranchId?: string|null, stats?: Record<string, number>, inventory?: Record<string, number>, journal?: string[], visitedBranches?: string[] }} snapshot
	 */
	restoreSnapshot(snapshot) {
		const restored = restoreFromSnapshot(snapshot, {
			statsManager: this.statsManager,
			maxJournalEntries: this.maxJournalEntries,
		});

		this.stats = restored.stats;
		this.inventory = restored.inventory;
		this.journal = restored.journal;
		this.visitedBranches = restored.visited;
		this.setCurrentBranch(restored.branchId);

		this.lastRoll = null;
		this.systemError = null;
	}

	cloneStatDefaults() {
		return this.statsManager.cloneDefaults();
	}

	resolveDynamicEffect(dynamic, context = {}) {
		return this.statsManager.resolveDynamicEffect(dynamic, context, this.lastRoll);
	}
}

export { DEFAULT_MAX_JOURNAL_ENTRIES };
