/**
 * Determines whether the inventory currently contains an item.
 * @param {Record<string, number>} inventory
 * @param {string} itemName
 * @returns {boolean}
 */
export function hasInventoryItem(inventory, itemName) {
	if (!inventory || typeof inventory !== "object") {
		return false;
	}
	if (typeof itemName !== "string") {
		return false;
	}
	const key = itemName.trim();
	if (!key) {
		return false;
	}
	const value = Object.prototype.hasOwnProperty.call(inventory, key) ? inventory[key] : 0;
	const numeric = Number(value);
	return Number.isFinite(numeric) && numeric > 0;
}

/**
 * Applies inventory effects to the provided inventory object.
 * @param {Record<string, number>} inventory
 * @param {{ item: string, delta: number }[]} effects
 * @returns {{ item: string, delta: number }[]}
 */
export function applyInventoryEffects(inventory, effects) {
	if (!inventory || typeof inventory !== "object") {
		return [];
	}
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

		const current = inventory[item] || 0;
		const updated = current + delta;
		if (updated <= 0) {
			delete inventory[item];
		} else {
			inventory[item] = updated;
		}

		applied.push({ item, delta });
	}

	return applied;
}
