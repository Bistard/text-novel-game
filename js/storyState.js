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
		this.reset();
	}

	/**
	 * Resets to defaults and sets the starting branch if provided.
	 * @param {string|null} [startBranchId]
	 */
	reset(startBranchId = null) {
		this.currentBranchId = startBranchId;
		this.stats = {};
		this.inventory = {};
		this.journal = [];
		this.lastRoll = null;
		this.systemError = null;
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
		this.currentBranchId = branchId;
	}

	/**
	 * @param {{ stat: string, delta: number }[]} effects
	 */
	applyStatEffects(effects) {
		for (const effect of effects) {
			const current = this.stats[effect.stat] || 0;
			this.stats[effect.stat] = current + effect.delta;
		}
	}

	/**
	 * @param {{ item: string, delta: number }[]} effects
	 */
	applyInventoryEffects(effects) {
		for (const effect of effects) {
			const current = this.inventory[effect.item] || 0;
			const updated = current + effect.delta;
			if (updated <= 0) {
				delete this.inventory[effect.item];
			} else {
				this.inventory[effect.item] = updated;
			}
		}
	}

	/**
	 * @param {string} text
	 */
	appendJournal(text) {
		if (!text) return;
		this.journal.push(text);
		if (this.journal.length > this.maxJournalEntries) {
			this.journal.splice(0, this.journal.length - this.maxJournalEntries);
		}
	}

	/**
	 * @param {string} stat
	 * @returns {number}
	 */
	getStatValue(stat) {
		return this.stats[stat] || 0;
	}

	/**
	 * @param {import("./storyUtilities.js").RollResult|null} roll
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
}
