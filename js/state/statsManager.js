const EMPTY_OBJECT = Object.create(null);

/**
 * Handles stat configuration, evaluation, and mutation logic for the story state.
 */
export class StatsManager {
	constructor() {
		this.defaults = Object.create(null);
	}

	/**
	 * Updates the configured stat defaults.
	 * @param {Record<string, number>} defaults
	 */
	configure(defaults = EMPTY_OBJECT) {
		this.defaults = Object.create(null);
		if (!defaults || typeof defaults !== "object") {
			return;
		}

		for (const [name, value] of Object.entries(defaults)) {
			if (typeof name !== "string") continue;
			const key = name.trim().toLowerCase();
			if (!key) continue;
			const numericValue = Number(value);
			this.defaults[key] = Number.isFinite(numericValue) ? numericValue : 0;
		}
	}

	/**
	 * Creates a clean copy of the stat defaults.
	 * @returns {Record<string, number>}
	 */
	cloneDefaults() {
		const snapshot = Object.create(null);
		for (const [stat, value] of Object.entries(this.defaults)) {
			snapshot[stat] = Number.isFinite(value) ? value : 0;
		}
		return snapshot;
	}

	/**
	 * Splits stat effects into known and unknown collections.
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[]} effects
	 * @returns {{ allowed: { stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[], unknown: string[] }}
	 */
	partitionEffects(effects) {
		const allowed = [];
		const unknown = new Set();

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

			const dynamic =
				effect && effect.dynamic && typeof effect.dynamic === "object"
					? {
							type: effect.dynamic.type,
							scale: Number.isFinite(Number(effect.dynamic.scale)) ? Number(effect.dynamic.scale) : 1,
					  }
					: null;

			const normalizedEffect = {
				stat: key,
				delta: Number(effect.delta),
				dynamic,
				label: effect.label || originalName,
			};

			if (Object.prototype.hasOwnProperty.call(this.defaults, key)) {
				allowed.push(normalizedEffect);
			} else {
				unknown.add(originalName);
			}
		}

		return { allowed, unknown: Array.from(unknown) };
	}

	/**
	 * Calculates stat deltas without mutating the provided stats object.
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[]} effects
	 * @param {{ rollResult?: import("../storyUtilities.js").RollResult|null }} [context]
	 * @param {import("../storyUtilities.js").RollResult|null} [lastRoll]
	 * @returns {{ evaluated: { stat: string, delta: number, label?: string }[], issues: string[] }}
	 */
	evaluateEffects(effects, context = EMPTY_OBJECT, lastRoll = null) {
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
			if (!key || !Object.prototype.hasOwnProperty.call(this.defaults, key)) {
				continue;
			}

			let delta = Number(effect.delta);
			if (!Number.isFinite(delta)) {
				delta = 0;
			}

			if (effect.dynamic && effect.dynamic.type) {
				const resolved = this.resolveDynamicEffect(effect.dynamic, context, lastRoll);
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
	 * Applies already evaluated stat deltas to the supplied stats object.
	 * @param {Record<string, number>} targetStats
	 * @param {{ stat: string, delta: number }[]} evaluated
	 * @returns {{ stat: string, delta: number }[]}
	 */
	applyEvaluatedEffects(targetStats, evaluated) {
		if (!targetStats || typeof targetStats !== "object") {
			return [];
		}
		if (!Array.isArray(evaluated) || !evaluated.length) {
			return [];
		}

		const applied = [];
		for (const effect of evaluated) {
			if (!effect || typeof effect.stat !== "string") {
				continue;
			}
			const key = effect.stat.trim().toLowerCase();
			if (!key || !Object.prototype.hasOwnProperty.call(this.defaults, key)) {
				continue;
			}

			const delta = Number(effect.delta);
			if (!Number.isFinite(delta) || delta === 0) {
				continue;
			}

			const base = Number(targetStats[key] ?? this.defaults[key] ?? 0);
			const safeBase = Number.isFinite(base) ? base : 0;
			targetStats[key] = safeBase + delta;
			applied.push({ stat: key, delta });
		}

		return applied;
	}

	/**
	 * Evaluates and applies stat effects in one step.
	 * @param {Record<string, number>} targetStats
	 * @param {{ stat: string, delta: number, dynamic?: { type: string, scale: number }, label?: string }[]} effects
	 * @param {{ rollResult?: import("../storyUtilities.js").RollResult|null }} [context]
	 * @param {import("../storyUtilities.js").RollResult|null} [lastRoll]
	 * @returns {{ applied: { stat: string, delta: number }[], issues: string[] }}
	 */
	applyEffects(targetStats, effects, context = EMPTY_OBJECT, lastRoll = null) {
		const { evaluated, issues } = this.evaluateEffects(effects, context, lastRoll);
		const applied = this.applyEvaluatedEffects(targetStats, evaluated);
		return { applied, issues };
	}

	/**
	 * Retrieves the current value for the requested stat, falling back to defaults.
	 * @param {Record<string, number>} stats
	 * @param {string} stat
	 * @returns {number}
	 */
	getValue(stats, stat) {
		if (typeof stat !== "string") {
			return 0;
		}
		const key = stat.trim().toLowerCase();
		if (!key) {
			return 0;
		}
		const current = stats && Number.isFinite(stats[key]) ? Number(stats[key]) : Number.NaN;
		if (Number.isFinite(current)) {
			return current;
		}
		const fallback = this.defaults[key];
		return Number.isFinite(fallback) ? fallback : 0;
	}

	/**
	 * Resolves a dynamic stat effect using either the provided roll context or last roll.
	 * @param {{ type: string, scale: number }} dynamic
	 * @param {{ rollResult?: import("../storyUtilities.js").RollResult|null }} [context]
	 * @param {import("../storyUtilities.js").RollResult|null} [lastRoll]
	 * @returns {number}
	 */
	resolveDynamicEffect(dynamic, context = EMPTY_OBJECT, lastRoll = null) {
		const scale = Number.isFinite(Number(dynamic.scale)) ? Number(dynamic.scale) : 1;
		const referenceRoll = context.rollResult || lastRoll || null;
		if (!referenceRoll) {
			return Number.NaN;
		}

		let base = Number.NaN;
		switch (dynamic.type) {
			case "roll-total":
				base = Number(referenceRoll.total);
				break;
			case "roll-dice":
				base = Number(referenceRoll.diceTotal);
				break;
			case "roll-stat":
				base = Number(referenceRoll.statValue);
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
