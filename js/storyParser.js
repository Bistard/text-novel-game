/**
 * Story parser for custom Twine-like plaintext format.
 * Supported directives:
 *
 * ::nodeId                     Start of a new node (meta section uses id "meta")
 * title: The Awakening         Single line property
 * tags: tag-one, tag-two
 * ending: good|bad|neutral
 * image: assets/path.png       Optional background illustration
 *
 * text:                        Multiline block (terminated by /text)
 * Paragraph 1
 * Paragraph 2
 * /text
 *
 * entry:                       Multiline block of automatic effects on enter (terminated by /entry)
 * adjust=resolve:+1,insight:+2
 * log=Note added to the journal.
 * item=add:Cipher Key
 * /entry
 *
 * choices:                     Repeated list of choices (terminated by /choices)
 * - Choice text -> nextNode | adjust=resolve:-1 | requires=resolve>=3
 * - Another choice -> successNode | test=insight+d6>=7?successNode:failureNode | log=Journal entry
 * /choices
 */

const SECTION_PREFIX = "::";
const COMMENT_PREFIX = "#";

/**
 * Parses the entire story from raw plaintext.
 * @param {string} raw
 * @returns {{ meta: StoryMeta, nodes: Record<string, StoryNode> }}
 */
export function parseStory(raw) {
	const sections = collectSections(raw);
	if (!sections.length) {
		throw new Error("Story file is empty or lacks sections.");
	}

	const metaSection = sections.find((section) => section.id.toLowerCase() === "meta");
	if (!metaSection) {
		throw new Error("Story file must include a ::meta section.");
	}

	const meta = parseMeta(metaSection);
	if (!meta.start) {
		throw new Error("Meta section must specify a start node (e.g., start: prologue).");
	}

	const nodes = {};
	for (const section of sections) {
		if (section.id.toLowerCase() === "meta") continue;
		nodes[section.id] = parseNode(section);
	}

	if (!nodes[meta.start]) {
		throw new Error(`Start node "${meta.start}" declared in meta section was not found.`);
	}

	return { meta, nodes };
}

/**
 * @param {string} raw
 * @returns {Array<{ id: string, lines: string[] }>}
 */
function collectSections(raw) {
	const lines = raw.split(/\r?\n/);
	const sections = [];
	let current = null;

	lines.forEach((line) => {
		const trimmed = line.trim();
		if (!trimmed && !current) {
			return;
		}

		if (trimmed.startsWith(SECTION_PREFIX)) {
			const id = trimmed.slice(SECTION_PREFIX.length).trim();
			if (!id) {
				throw new Error("Section header is missing an identifier.");
			}
			current = { id, lines: [] };
			sections.push(current);
		} else if (current) {
			current.lines.push(line);
		}
	});

	return sections;
}

/**
 * @typedef {Object} StoryMeta
 * @property {string} title
 * @property {string} description
 * @property {string} start
 * @property {Record<string, number>} stats
 * @property {string[]} inventory
 * @property {string[]} tags
 * @property {Record<string, any>} extras
 */

/**
 * @param {{ id: string, lines: string[] }} section
 * @returns {StoryMeta}
 */
function parseMeta(section) {
	const meta = {
		title: "",
		description: "",
		start: "",
		stats: {},
		inventory: [],
		tags: [],
		extras: {},
	};

	let cursor = 0;
	while (cursor < section.lines.length) {
		const rawLine = section.lines[cursor];
		cursor += 1;
		if (!rawLine) continue;
		const line = rawLine.trim();
		if (!line || line.startsWith(COMMENT_PREFIX)) continue;

		if (line.startsWith("description:")) {
			const block = collectBlock(section.lines, cursor, "/description");
			meta.description = block.lines.join("\n").trim();
			cursor = block.nextIndex;
			continue;
		}

		if (line.startsWith("stats:")) {
			const block = collectBlock(section.lines, cursor, "/stats");
			meta.stats = parseKeyValueList(block.lines, "stat");
			cursor = block.nextIndex;
			continue;
		}

		if (line.startsWith("inventory:")) {
			const block = collectBlock(section.lines, cursor, "/inventory");
			meta.inventory = parseList(block.lines);
			cursor = block.nextIndex;
			continue;
		}

		if (line.startsWith("tags:")) {
			meta.tags = splitList(line.slice("tags:".length));
			continue;
		}

		const kv = splitKeyValue(line);
		if (!kv) continue;

		const [key, value] = kv;
		switch (key) {
			case "title":
				meta.title = value;
				break;
			case "start":
				meta.start = value;
				break;
			default:
				meta.extras[key] = value;
				break;
		}
	}

	return meta;
}

/**
 * @typedef {Object} StoryNode
 * @property {string} id
 * @property {string} title
 * @property {string} text
 * @property {StoryChoice[]} choices
 * @property {string[]} tags
 * @property {string|null} ending
 * @property {NodeEntryEffect} entry
 * @property {string|null} image
 */

/**
 * @typedef {Object} NodeEntryEffect
 * @property {Record<string, number>} adjust
 * @property {{ add: string[], remove: string[] }} inventory
 * @property {string[]} log
 */

/**
 * @typedef {Object} StoryChoice
 * @property {string} id
 * @property {string} text
 * @property {string|null} target
 * @property {Record<string, number>} adjust
 * @property {{ add: string[], remove: string[] }} inventory
 * @property {string|null} log
 * @property {ChoiceRequirement[]} requires
 * @property {ChoiceTest|null} test
 * @property {boolean} hidden
 * @property {string[]} tags
 */

/**
 * @typedef {Object} ChoiceRequirement
 * @property {"stat"|"item"|"flag"} type
 * @property {string} key
 * @property {">="|"<="|"=="|"!="|">"|"<"} comparator
 * @property {number|string} value
 * @property {string} [reason]
 */

/**
 * @typedef {Object} ChoiceTest
 * @property {string|null} stat
 * @property {number} modifier
 * @property {{ count: number, sides: number }} dice
 * @property {number} threshold
 * @property {">="|">"} comparator
 * @property {string} success
 * @property {string} failure
 * @property {string|null} label
 */

/**
 * @param {{ id: string, lines: string[] }} section
 * @returns {StoryNode}
 */
function parseNode(section) {
	const node = {
		id: section.id,
		title: "",
		text: "",
		choices: [],
		tags: [],
		ending: null,
		entry: {
			adjust: {},
			inventory: { add: [], remove: [] },
			log: [],
		},
		image: null,
	};

	let cursor = 0;
	let choiceIndex = 0;

	while (cursor < section.lines.length) {
		const rawLine = section.lines[cursor];
		cursor += 1;
		if (!rawLine) continue;
		const line = rawLine.trim();
		if (!line || line.startsWith(COMMENT_PREFIX)) continue;

		if (line.startsWith("text:")) {
			const block = collectBlock(section.lines, cursor, "/text");
			node.text = block.lines.join("\n").trim();
			cursor = block.nextIndex;
			continue;
		}

		if (line.startsWith("entry:")) {
			const block = collectBlock(section.lines, cursor, "/entry");
			parseEntryBlock(block.lines, node.entry);
			cursor = block.nextIndex;
			continue;
		}

		if (line.startsWith("choices:")) {
			const block = collectBlock(section.lines, cursor, "/choices");
			for (const choiceLine of block.lines) {
				const trimmed = choiceLine.trim();
				if (!trimmed || trimmed.startsWith(COMMENT_PREFIX)) continue;
				if (!trimmed.startsWith("-")) {
					throw new Error(`Choice lines must start with "-". Issue in node "${section.id}".`);
				}
				const parsed = parseChoice(trimmed.slice(1).trim(), section.id, choiceIndex);
				node.choices.push(parsed);
				choiceIndex += 1;
			}
			cursor = block.nextIndex;
			continue;
		}

		if (line.startsWith("tags:")) {
			node.tags = splitList(line.slice("tags:".length));
			continue;
		}

		if (line.startsWith("ending:")) {
			node.ending = line.slice("ending:".length).trim() || null;
			continue;
		}

		const kv = splitKeyValue(line);
		if (!kv) continue;
		const [key, value] = kv;
		switch (key) {
			case "title":
				node.title = value;
				break;
			case "image":
				node.image = value;
				break;
			default:
				// Preserve any unknown key for debugging.
				if (!node.extras) node.extras = {};
				node.extras[key] = value;
				break;
		}
	}

	return node;
}

/**
 * @param {string[]} lines
 * @param {{ add: string[], remove: string[] }} inventory
 */
function applyInventoryDirectives(lines, inventory) {
	for (const entry of lines) {
		const trimmed = entry.trim();
		if (!trimmed) continue;
		const [directive, value] = trimmed.split(":").map((token) => token.trim());
		if (!directive || !value) continue;
		if (directive === "add") {
			inventory.add.push(value);
		} else if (directive === "remove") {
			inventory.remove.push(value);
		}
	}
}

/**
 * @param {string[]} lines
 * @param {NodeEntryEffect} target
 */
function parseEntryBlock(lines, target) {
	for (const raw of lines) {
		const line = raw.trim();
		if (!line || line.startsWith(COMMENT_PREFIX)) continue;

		if (line.startsWith("adjust=")) {
			const adjust = parseAdjustments(line.slice("adjust=".length));
			mergeAdjustments(target.adjust, adjust);
			continue;
		}

		if (line.startsWith("item=")) {
			const inventoryLines = line
				.slice("item=".length)
				.split(",")
				.map((token) => token.trim());
			applyInventoryDirectives(inventoryLines, target.inventory);
			continue;
		}

		if (line.startsWith("log=")) {
			const entry = line.slice("log=".length).trim();
			if (entry) target.log.push(entry);
			continue;
		}
	}
}

/**
 * @param {string} raw
 * @param {string} nodeId
 * @param {number} index
 * @returns {StoryChoice}
 */
function parseChoice(raw, nodeId, index) {
	const segments = raw.split("|").map((segment) => segment.trim()).filter(Boolean);
	if (!segments.length) {
		throw new Error(`Empty choice definition in node "${nodeId}".`);
	}

	const choiceDescriptor = segments.shift();
	const { text, target } = parseChoiceDescriptor(choiceDescriptor, nodeId);

	const choice = {
		id: `${nodeId}:${index}`,
		text,
		target,
		adjust: {},
		inventory: { add: [], remove: [] },
		log: null,
		requires: [],
		test: null,
		hidden: false,
		tags: [],
	};

	for (const segment of segments) {
		if (!segment) continue;
		if (segment.startsWith("adjust=")) {
			const adjust = parseAdjustments(segment.slice("adjust=".length));
			mergeAdjustments(choice.adjust, adjust);
			continue;
		}

		if (segment.startsWith("item=")) {
			const entries = segment
				.slice("item=".length)
				.split(",")
				.map((token) => token.trim());
			applyInventoryDirectives(entries, choice.inventory);
			continue;
		}

		if (segment.startsWith("log=")) {
			choice.log = segment.slice("log=".length).trim();
			continue;
		}

		if (segment.startsWith("requires=")) {
			const requires = parseRequirements(segment.slice("requires=".length));
			choice.requires.push(...requires);
			continue;
		}

		if (segment.startsWith("hidden")) {
			choice.hidden = true;
			continue;
		}

		if (segment.startsWith("test=")) {
			choice.test = parseTest(segment.slice("test=".length));
			continue;
		}

		if (segment.startsWith("chance=")) {
			choice.test = parseTest(segment.slice("chance=".length), true);
			continue;
		}

		if (segment.startsWith("tags=")) {
			choice.tags.push(...splitList(segment.slice("tags=".length)));
			continue;
		}
	}

	return choice;
}

/**
 * @param {string} descriptor
 * @param {string} nodeId
 */
function parseChoiceDescriptor(descriptor, nodeId) {
	const parts = descriptor.split("->");
	if (parts.length < 2) {
		return { text: descriptor.trim(), target: null };
	}

	const [rawText, rawTarget] = parts;
	const text = rawText.trim();
	const target = rawTarget ? rawTarget.trim() : null;

	if (!text) {
		throw new Error(`Choice text missing in node "${nodeId}".`);
	}

	return { text, target };
}

/**
 * @param {string} raw
 * @returns {ChoiceRequirement[]}
 */
function parseRequirements(raw) {
	const parts = raw.split("&").map((token) => token.trim()).filter(Boolean);
	const requirements = [];

	for (const part of parts) {
		if (!part) continue;
		if (part.startsWith("item:") || part.startsWith("item=")) {
			const value = part.slice(5).trim();
			if (!value) continue;
			requirements.push({
				type: "item",
				key: value,
				comparator: "==",
				value,
			});
			continue;
		}

		const comparatorMatch = part.match(/(>=|<=|==|!=|>|<)/);
		if (!comparatorMatch) continue;
		const comparator = comparatorMatch[0];
		const [lhs, rhsRaw] = part.split(comparator).map((token) => token.trim());
		if (!lhs) continue;
		const rhs = isNaN(Number(rhsRaw)) ? rhsRaw : Number(rhsRaw);

		requirements.push({
			type: "stat",
			key: lhs,
			comparator,
			value: rhs,
		});
	}

	return requirements;
}

/**
 * @param {string} raw
 * @param {boolean} [forceRandom=false]
 * @returns {ChoiceTest|null}
 */
function parseTest(raw, forceRandom = false) {
	if (!raw) return null;
	const [conditionPart, outcomePart] = raw.split("?");
	if (!outcomePart) {
		throw new Error(`Test definition "${raw}" is missing success/failure nodes.`);
	}

	const [successPart, failurePart] = outcomePart.split(":").map((token) => token.trim());
	if (!successPart || !failurePart) {
		throw new Error(`Test definition "${raw}" must include both success and failure nodes.`);
	}

	const condition = conditionPart.trim();
	const comparatorMatch = condition.match(/(>=|>)/);
	if (!comparatorMatch) {
		throw new Error(`Test condition "${condition}" missing comparator (>= or >).`);
	}
	const comparator = comparatorMatch[0];
	const [leftExpr, thresholdRaw] = condition.split(comparator).map((token) => token.trim());

	const threshold = Number(thresholdRaw);
	if (Number.isNaN(threshold)) {
		throw new Error(`Test condition "${condition}" must compare against a number.`);
	}

	const { stat, modifier, dice } = parseExpression(leftExpr, forceRandom);

	return {
		stat,
		modifier,
		dice,
		threshold,
		comparator,
		success: successPart,
		failure: failurePart,
		label: null,
	};
}

/**
 * @param {string} expr
 * @param {boolean} forceRandom
 */
function parseExpression(expr, forceRandom) {
	const tokens = expr.split(/\s*\+\s*/).map((token) => token.trim()).filter(Boolean);
	let stat = null;
	let modifier = 0;
	let dice = { count: 0, sides: 0 };
	let sawDice = false;

	for (const token of tokens) {
		if (/^d\d+$/i.test(token)) {
			const sides = Number(token.slice(1));
			dice = { count: 1, sides };
			sawDice = true;
			continue;
		}

		const numeric = Number(token);
		if (!Number.isNaN(numeric)) {
			modifier += numeric;
			continue;
		}

		stat = token;
	}

	if (forceRandom && !sawDice) {
		dice = { count: 1, sides: 6 };
	}

	return { stat, modifier, dice };
}

/**
 * @param {string} raw
 * @returns {Record<string, number>}
 */
function parseAdjustments(raw) {
	const result = {};
	const parts = raw.split(",").map((token) => token.trim());

	for (const part of parts) {
		if (!part) continue;
		const [stat, deltaRaw] = part.split(":").map((token) => token.trim());
		if (!stat || deltaRaw == null) continue;
		const delta = Number(deltaRaw);
		if (Number.isNaN(delta)) continue;
		result[stat] = (result[stat] || 0) + delta;
	}

	return result;
}

/**
 * @param {Record<string, number>} target
 * @param {Record<string, number>} source
 */
function mergeAdjustments(target, source) {
	for (const [key, value] of Object.entries(source)) {
		target[key] = (target[key] || 0) + value;
	}
}

/**
 * @param {string[]} lines
 * @param {string} terminator
 * @returns {{ lines: string[], nextIndex: number }}
 */
function collectBlock(lines, startIndex, terminator) {
	const collected = [];
	let index = startIndex;

	while (index < lines.length) {
		const raw = lines[index];
		index += 1;
		if (raw.trim() === terminator) {
			break;
		}
		collected.push(raw);
	}

	return { lines: collected, nextIndex: index };
}

/**
 * @param {string} line
 * @returns {[string, string]|null}
 */
function splitKeyValue(line) {
	const delimiterIndex = line.indexOf(":");
	if (delimiterIndex === -1) return null;
	const key = line.slice(0, delimiterIndex).trim().toLowerCase();
	const value = line.slice(delimiterIndex + 1).trim();
	if (!key) return null;
	return [key, value];
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function splitList(value) {
	return value
		.split(",")
		.map((token) => token.trim())
		.filter(Boolean);
}

/**
 * @param {string[]} lines
 * @param {string} kind
 * @returns {Record<string, number>}
 */
function parseKeyValueList(lines, kind) {
	const result = {};
	for (const raw of lines) {
		const line = raw.trim();
		if (!line || line.startsWith(COMMENT_PREFIX)) continue;
		const normalized = line.startsWith("-") ? line.slice(1).trim() : line;
		const [key, value] = normalized.split(":").map((token) => token.trim());
		if (!key || value == null) continue;
		const numeric = Number(value);
		if (Number.isNaN(numeric)) {
			throw new Error(`Unable to parse ${kind} value "${line}".`);
		}
		result[key] = numeric;
	}
	return result;
}

/**
 * @param {string[]} lines
 */
function parseList(lines) {
	const result = [];
	for (const raw of lines) {
		const line = raw.trim();
		if (!line || line.startsWith(COMMENT_PREFIX)) continue;
		const normalized = line.startsWith("-") ? line.slice(1).trim() : line;
		if (normalized) result.push(normalized);
	}
	return result;
}

