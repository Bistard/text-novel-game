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
		this.statDefaults = Object.create(null);
		this.reset();
	}

	/**
	 * Resets to defaults and sets the starting branch if provided.
	 * @param {string|null} [startBranchId]
	 */
	reset(startBranchId = null) {
		this.currentBranchId = startBranchId;
		this.stats = this.cloneStatDefaults();
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
	 * Sets the allowed stats and their default values.
	 * @param {Record<string, number>} defaults
	 */
	configureStats(defaults = {}) {
		this.statDefaults = Object.create(null);
		if (defaults && typeof defaults === "object") {
			for (const [name, value] of Object.entries(defaults)) {
				if (typeof name !== "string") continue;
				const key = name.trim().toLowerCase();
				if (!key) continue;
				const numericValue = Number(value);
				this.statDefaults[key] = Number.isFinite(numericValue) ? numericValue : 0;
			}
		}
		this.stats = this.cloneStatDefaults();
	}

	/**
	 * Splits stat effects into recognised and unknown collections.
	 * @param {{ stat: string, delta: number }[]} effects
	 * @returns {{ allowed: { stat: string, delta: number }[], unknown: string[] }}
	 */
	partitionStatEffects(effects) {
		const allowed = [];
		const unknownNames = new Set();

		if (!Array.isArray(effects)) {
			return { allowed, unknown: [] };
		}

		for (const effect of effects) {
			if (!effect || typeof effect.stat !== "string") {
				continue;
			}
			const originalName = effect.stat.trim();
			if (!originalName) {
				continue;
			}
			const key = originalName.toLowerCase();
			const delta = Number(effect.delta);
			const normalizedEffect = {
				stat: key,
				delta: Number.isFinite(delta) ? delta : 0,
			};
			if (Object.prototype.hasOwnProperty.call(this.statDefaults, key)) {
				allowed.push(normalizedEffect);
			} else {
				unknownNames.add(originalName);
			}
		}

		return { allowed, unknown: Array.from(unknownNames) };
	}

	/**
	 * @param {{ stat: string, delta: number }[]} effects
	 * @returns {{ stat: string, delta: number }[]}
	 */
	applyStatEffects(effects) {
		if (!Array.isArray(effects) || !effects.length) {
			return [];
		}

		const applied = [];
		for (const effect of effects) {
			if (!effect || typeof effect.stat !== "string") {
				continue;
			}
			const key = effect.stat.trim().toLowerCase();

			if (!key || !Object.prototype.hasOwnProperty.call(this.statDefaults, key)) {
				continue;
			}

			const delta = Number(effect.delta);
			const numericDelta = Number.isFinite(delta) ? delta : 0;
			const base = Number(this.stats[key] ?? this.statDefaults[key] ?? 0);
			const safeBase = Number.isFinite(base) ? base : 0;
			this.stats[key] = safeBase + numericDelta;
			applied.push({ stat: key, delta: numericDelta });
		}

		return applied;
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
		if (typeof stat !== "string") {
			return 0;
		}
		const key = stat.trim().toLowerCase();
		if (!key) {
			return 0;
		}
		const current = this.stats[key];
		if (Number.isFinite(current)) {
			return current;
		}
		const fallback = this.statDefaults[key];
		return Number.isFinite(fallback) ? fallback : 0;
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

	cloneStatDefaults() {
		const snapshot = Object.create(null);
		for (const [stat, value] of Object.entries(this.statDefaults)) {
			snapshot[stat] = Number.isFinite(value) ? value : 0;
		}
		return snapshot;
	}
}
