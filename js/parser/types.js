/**
 * @typedef {Object} ParseContext
 * @property {BranchParseContext|null} current
 * @property {boolean} descriptionActive
 * @property {BranchParseContext[]} branches
 */

/**
 * @typedef {Object} BranchParseContext
 * @property {string|null} id
 * @property {string} title
 * @property {string[]} descriptionLines
 * @property {StoryChoiceDraft[]} choices
 */

/**
 * @typedef {Object} StoryChoiceDraft
 * @property {string} text
 * @property {string|null} next
 * @property {{ stat: string, delta: number, dynamic?: { type: "roll-total"|"roll-dice"|"roll-stat", scale: number, token?: string } }[]} stats
 * @property {{ item: string, delta: number }[]} inventory
 * @property {RollDirective|null} roll
 * @property {ConditionDefinition|null} visibilityCondition
 * @property {ConditionDefinition|null} validCondition
 */

/**
 * @typedef {Object} StoryBranch
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {StoryChoice[]} choices
 */

/**
 * @typedef {Object} StoryChoice
 * @property {string} id
 * @property {string} text
 * @property {string|null} next
 * @property {{ stat: string, delta: number, dynamic?: { type: "roll-total"|"roll-dice"|"roll-stat", scale: number, token?: string } }[]} stats
 * @property {{ item: string, delta: number }[]} inventory
 * @property {RollDirective|null} roll
 * @property {ConditionDefinition|null} visibilityCondition
 * @property {ConditionDefinition|null} validCondition
 */

/**
 * @typedef {Object} RollDirective
 * @property {string|null} stat
 * @property {{ count: number, sides: number }} dice
 * @property {number} target
 * @property {string} ok
 * @property {string} fail
 */

/**
 * @typedef {Object} ConditionDefinition
 * @property {"visited-all"|"visited-any"|"inventory-all"|"inventory-any"} kind
 * @property {string[]} values
 * @property {string} raw
 */

export {};
