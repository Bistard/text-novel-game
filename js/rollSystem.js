/**
 * Executes a randomisation test based on the provided stats lookup.
 * @param {RollDirective} directive
 * @param {(stat: string) => number} [getStatValue]
 * @param {() => number} [randomSource]
 * @returns {RollResult}
 */
export function runRoll(directive, getStatValue = () => 0, randomSource = Math.random) {
	const resolveStat = typeof getStatValue === "function" ? getStatValue : () => 0;
	const rolls = [];
	let diceTotal = 0;
	const statValue = directive.stat ? resolveStat(directive.stat) || 0 : 0;

	for (let i = 0; i < directive.dice.count; i += 1) {
		const roll = randomInt(1, directive.dice.sides, randomSource);
		rolls.push(roll);
		diceTotal += roll;
	}

	const total = statValue + diceTotal;
	const success = total >= directive.target;

	return {
		directive,
		statValue,
		rolls,
		diceTotal,
		total,
		success,
	};
}

/**
 * @param {number} min
 * @param {number} max
 * @param {() => number} randomSource
 */
function randomInt(min, max, randomSource) {
	return Math.floor(randomSource() * (max - min + 1)) + min;
}

/**
 * @typedef {Object} RollDirective
 * @property {string|null} stat
 * @property {{ count: number, sides: number }} dice
 * @property {number} target
 * @property {string} ok
 * @property {string} fail
 */

/**
 * @typedef {Object} RollResult
 * @property {RollDirective} directive
 * @property {number} statValue
 * @property {number[]} rolls
 * @property {number} diceTotal
 * @property {number} total
 * @property {boolean} success
 */
