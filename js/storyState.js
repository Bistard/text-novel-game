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
		this.stats = this.cloneStatDefaults();
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
		if (typeof branchId !== "string") {
			return;
		}
		const id = branchId.trim();
		if (!id) {
			return;
		}
		this.visitedBranches.add(id);
	}

	/**
	 * Checks whether a branch has been visited by the player.
	 * @param {string} branchId
	 */
	hasVisitedBranch(branchId) {
		if (!branchId || typeof branchId !== "string") {
			return false;
		}
		if (!this.visitedBranches || !(this.visitedBranches instanceof Set)) {
			return false;
		}
		return this.visitedBranches.has(branchId.trim());
	}

	/**
	 * Returns an array snapshot of visited branches.
	 * @returns {string[]}
	 */
	getVisitedBranches() {
		if (!this.visitedBranches || !(this.visitedBranches instanceof Set)) {
			return [];
		}
		return Array.from(this.visitedBranches);
	}

	/**
	 * Checks whether the inventory currently contains an item.
	 * @param {string} itemName
	 * @returns {boolean}
	 */
	hasInventoryItem(itemName) {
		if (typeof itemName !== "string") {
			return false;
		}
		const key = itemName.trim();
		if (!key) {
			return false;
		}
		const value = this.inventory && Object.prototype.hasOwnProperty.call(this.inventory, key) ? this.inventory[key] : 0;
		const numeric = Number(value);
		return Number.isFinite(numeric) && numeric > 0;
	}

	/**
	 * Evaluates a condition against the current state.
	 * @param {import("./storyParser.js").ConditionDefinition|null|undefined} condition
	 * @returns {boolean}
	 */
	evaluateCondition(condition) {
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
				return values.every((id) => this.hasVisitedBranch(id));
			case "visited-any":
				return values.some((id) => this.hasVisitedBranch(id));
			case "inventory-all":
				return values.every((item) => this.hasInventoryItem(item));
			case "inventory-any":
				return values.some((item) => this.hasInventoryItem(item));
			default:
				return false;
		}
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
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number } }[]} effects
	 * @returns {{ allowed: { stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[], unknown: string[] }}
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
			const dynamic =
				effect && effect.dynamic && typeof effect.dynamic === "object"
					? {
							type: effect.dynamic.type,
							scale: Number.isFinite(Number(effect.dynamic.scale)) ? Number(effect.dynamic.scale) : 1,
					  }
					: null;

			const normalizedEffect = {
				stat: key,
				delta: Number.isFinite(delta) ? delta : 0,
				label: originalName,
			};
			if (dynamic && dynamic.type) {
				normalizedEffect.dynamic = dynamic;
			}
			if (Object.prototype.hasOwnProperty.call(this.statDefaults, key)) {
				allowed.push(normalizedEffect);
			} else {
				unknownNames.add(originalName);
			}
		}

		return { allowed, unknown: Array.from(unknownNames) };
	}

	/**
	 * Evaluates and applies stat effects.
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[]} effects
	 * @param {{ rollResult?: import("./storyUtilities.js").RollResult|null }} [context]
	 * @returns {{ applied: { stat: string, delta: number }[], issues: string[] }}
	 */
	applyStatEffects(effects, context = {}) {
		const { evaluated, issues } = this.evaluateStatEffects(effects, context);
		const applied = this.applyEvaluatedStatEffects(evaluated);
		return { applied, issues };
	}

	/**
	 * Computes the numeric deltas for the provided effects without mutating state.
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[]} effects
	 * @param {{ rollResult?: import("./storyUtilities.js").RollResult|null }} [context]
	 * @returns {{ evaluated: { stat: string, delta: number, label?: string }[], issues: string[] }}
	 */
	evaluateStatEffects(effects, context = {}) {
		const evaluated = [];
		const issues = [];
		if (!Array.isArray(effects) || !effects.length) {
			return { evaluated, issues };
		}

		for (const effect of effects) {
			if (!effect || typeof effect.stat !== "string") {
				continue;
			}
			const key = effect.stat.trim().toLowerCase();

			if (!key || !Object.prototype.hasOwnProperty.call(this.statDefaults, key)) {
				continue;
			}

			let delta = Number(effect.delta);
			if (!Number.isFinite(delta)) {
				delta = 0;
			}

			if (effect.dynamic && effect.dynamic.type) {
				const resolved = this.resolveDynamicEffect(effect.dynamic, context);
				if (!Number.isFinite(resolved)) {
					const label = effect.label || effect.stat;
					issues.push(`Unable to resolve dynamic value for stat "${label}".`);
					continue;
				}
				delta = resolved;
			}

			if (!Number.isFinite(delta)) {
				continue;
			}

			evaluated.push({ stat: key, delta, label: effect.label || effect.stat });
		}

		return { evaluated, issues };
	}

	/**
	 * Applies already evaluated stat effects to the state.
	 * @param {{ stat: string, delta: number }[]} effects
	 * @returns {{ stat: string, delta: number }[]}
	 */
        applyEvaluatedStatEffects(effects) {
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
                        if (!Number.isFinite(delta) || delta === 0) {
                                continue;
                        }

                        const base = Number(this.stats[key] ?? this.statDefaults[key] ?? 0);
                        const safeBase = Number.isFinite(base) ? base : 0;
                        this.stats[key] = safeBase + delta;
                        applied.push({ stat: key, delta });
                }

                return applied;
        }

        /**
         * @param {{ item: string, delta: number }[]} effects
         * @returns {{ item: string, delta: number }[]}
         */
        applyInventoryEffects(effects) {
                if (!Array.isArray(effects) || !effects.length) {
                        return [];
                }

                const applied = [];
                for (const effect of effects) {
                        if (!effect || typeof effect.item !== "string") {
                                continue;
                        }

                        const item = effect.item.trim();
                        if (!item) {
                                continue;
                        }

                        const delta = Number(effect.delta);
                        if (!Number.isFinite(delta) || delta === 0) {
                                continue;
                        }

                        const current = this.inventory[item] || 0;
                        const updated = current + delta;
                        if (updated <= 0) {
                                delete this.inventory[item];
                        } else {
                                this.inventory[item] = updated;
                        }

                        applied.push({ item, delta });
                }

                return applied;
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

	/**
	 * Creates a serialisable snapshot of the current game state.
	 * @returns {{ currentBranchId: string|null, stats: Record<string, number>, inventory: Record<string, number>, journal: string[], visitedBranches: string[] }}
	 */
	createSnapshot() {
		return {
			currentBranchId: this.getCurrentBranchId(),
			stats: { ...this.stats },
			inventory: { ...this.inventory },
			journal: this.journal.slice(),
			visitedBranches: this.getVisitedBranches(),
		};
	}

	/**
	 * Restores state from a previously created snapshot.
	 * @param {{ currentBranchId?: string|null, stats?: Record<string, number>, inventory?: Record<string, number>, journal?: string[], visitedBranches?: string[] }} snapshot
	 */
	restoreSnapshot(snapshot) {
		if (!snapshot || typeof snapshot !== "object") {
			throw new Error("Invalid save snapshot payload.");
		}

		const stats = this.cloneStatDefaults();
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
		this.stats = stats;

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
		this.inventory = inventory;

		const entries = Array.isArray(snapshot.journal) ? snapshot.journal.filter((entry) => typeof entry === "string" && entry.trim()) : [];
		if (entries.length > this.maxJournalEntries) {
			this.journal = entries.slice(entries.length - this.maxJournalEntries);
		} else {
			this.journal = entries.slice();
		}

		const visited = new Set();
		if (Array.isArray(snapshot.visitedBranches)) {
			for (const entry of snapshot.visitedBranches) {
				if (typeof entry !== "string") continue;
				const id = entry.trim();
				if (!id) continue;
				visited.add(id);
			}
		}
		this.visitedBranches = visited;

		const branchId =
			typeof snapshot.currentBranchId === "string" && snapshot.currentBranchId.trim()
				? snapshot.currentBranchId.trim()
				: null;
		this.setCurrentBranch(branchId);

		this.lastRoll = null;
		this.systemError = null;
	}

	cloneStatDefaults() {
		const snapshot = Object.create(null);
		for (const [stat, value] of Object.entries(this.statDefaults)) {
			snapshot[stat] = Number.isFinite(value) ? value : 0;
		}
		return snapshot;
	}

	resolveDynamicEffect(dynamic, context = {}) {
		const scale = Number.isFinite(Number(dynamic.scale)) ? Number(dynamic.scale) : 1;
		const rollResult = context.rollResult || this.lastRoll;
		if (!rollResult) {
			return Number.NaN;
		}

		let base = Number.NaN;
		switch (dynamic.type) {
			case "roll-total":
				base = Number(rollResult.total);
				break;
			case "roll-dice":
				base = Number(rollResult.diceTotal);
				break;
			case "roll-stat":
				base = Number(rollResult.statValue);
				break;
			default:
				base = Number.NaN;
		}

		if (!Number.isFinite(base)) {
			return Number.NaN;
		}

		return scale * base;
	}
}
