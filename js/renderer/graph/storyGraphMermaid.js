/**
 * Builds a Mermaid flowchart definition representing the story graph.
 * @param {{ story?: { branches?: Record<string, import("../../parser/types.js").StoryBranch> }, currentBranchId?: string|null, visitedBranches?: Iterable<string>|null }} options
 */
export function buildMermaidGraphDefinition({
	story = null,
	currentBranchId = null,
	visitedBranches = null,
} = {}) {
	if (!story || !story.branches) {
		return null;
	}
	const branches = story.branches;
	const allIds = Object.keys(branches);
	if (!allIds.length) {
		return null;
	}

	const sanitizedMap = new Map();
	const usedSanitized = new Set();
	const nodeMeta = new Map();
	const classAssignments = {
		current: new Set(),
		unvisited: new Set(),
	};
	let currentNodeId = null;
	const visitedSet = normalizeVisitedBranches(visitedBranches);
	const hasVisitedData = visitedSet.size > 0;

	for (const branchId of allIds) {
		const sanitized = createMermaidId(branchId, usedSanitized);
		sanitizedMap.set(branchId, sanitized);

		const branch = branches[branchId];
		const labelSource = (branch?.title || branch?.id || branchId || "").trim();
		const label = labelSource || branchId;
		const tooltipParts = [];
		if (branch?.title) {
			tooltipParts.push(branch.title);
		}
		if (branch?.id && branch?.id !== branch?.title) {
			tooltipParts.push(`ID: ${branch.id}`);
		}
		const tooltip = tooltipParts.length ? tooltipParts.join(" | ") : labelSource;

		let isVisited = hasVisitedData ? visitedSet.has(branchId) : false;
		if (currentBranchId && branchId === currentBranchId) {
			classAssignments.current.add(sanitized);
			currentNodeId = sanitized;
			isVisited = true;
		}

		nodeMeta.set(sanitized, { id: branchId, label, tooltip });

		if (hasVisitedData && !isVisited) {
			classAssignments.unvisited.add(sanitized);
		}
	}

	const edgeEntries = buildEdgeList(branches, sanitizedMap);

	const lines = [];
	lines.push("%% Story graph generated at runtime");
	lines.push("graph LR");
	lines.push("  %% Nodes");
	for (const [branchId, sanitized] of sanitizedMap) {
		if (!nodeMeta.has(sanitized)) continue;
		const meta = nodeMeta.get(sanitized);
		const label = escapeMermaidLabel(meta?.label || branchId || sanitized);
		lines.push(`  ${sanitized}["${label}"]`);
	}

	lines.push("  %% Edges");
	for (const edge of edgeEntries) {
		lines.push(`  ${edge.from} --> ${edge.to}`);
	}

	lines.push("  %% Node Classes");
	const classDefLines = buildClassDefLines(classAssignments);
	lines.push(...classDefLines);

	return {
		definition: lines.join("\n"),
		nodeMeta,
		currentNodeId,
	};
}

function buildEdgeList(branches, sanitizedMap) {
	const edges = [];
	const seen = new Set();
	for (const [branchId, branch] of Object.entries(branches)) {
		const from = sanitizedMap.get(branchId);
		if (!from || !branch?.choices) continue;
		for (const choice of branch.choices) {
			if (choice.next) {
				const to = sanitizedMap.get(choice.next);
				if (to) {
					const key = `${from}->${to}`;
					if (!seen.has(key)) {
						seen.add(key);
						edges.push({ from, to });
					}
				}
			}
			if (choice.roll) {
				if (choice.roll.ok) {
					const to = sanitizedMap.get(choice.roll.ok);
					if (to) {
						const key = `${from}->${to}`;
						if (!seen.has(key)) {
							seen.add(key);
							edges.push({ from, to });
						}
					}
				}
				if (choice.roll.fail) {
					const to = sanitizedMap.get(choice.roll.fail);
					if (to) {
						const key = `${from}->${to}`;
						if (!seen.has(key)) {
							seen.add(key);
							edges.push({ from, to });
						}
					}
				}
			}
		}
	}
	return edges;
}

function buildClassDefLines(classAssignments) {
	const lines = [];
	const classDefinitions = [
		["default", "fill:#141a31,stroke:#49d2ff,stroke-width:2px"],
		["unvisited", "fill:#1a1d29,stroke:#3a3f55,stroke-width:1.5px,color:#8590b5"],
		["current", "stroke:#63f5c0,stroke-width:3px"],
	];

	for (const [name, definition] of classDefinitions) {
		lines.push(`  classDef ${name} ${definition};`);
	}

	if (!classAssignments || typeof classAssignments !== "object") {
		return lines;
	}

	const assignmentOrder = ["unvisited", "current"];
	for (const className of assignmentOrder) {
		const nodes = classAssignments[className];
		if (!nodes || !(nodes instanceof Set) || nodes.size === 0) {
			continue;
		}
		const identifiers = Array.from(nodes);
		if (!identifiers.length) {
			continue;
		}
		lines.push(`  class ${identifiers.join(",")} ${className};`);
	}
	return lines;
}

function createMermaidId(branchId, used) {
	const base = sanitizeMermaidId(branchId);
	let candidate = base;
	let counter = 1;
	while (used.has(candidate)) {
		candidate = `${base}_${counter++}`;
	}
	used.add(candidate);
	return candidate;
}

function sanitizeMermaidId(value) {
	const cleaned = String(value ?? "")
		.trim()
		.replace(/[^A-Za-z0-9_]/g, "_");
	if (!cleaned) {
		return "Node";
	}
	if (!/^[A-Za-z]/.test(cleaned)) {
		return `N_${cleaned}`;
	}
	return cleaned;
}

function escapeMermaidLabel(value) {
	return String(value ?? "")
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\r?\n|\r/g, " ")
		.trim();
}

function normalizeVisitedBranches(input) {
	const visited = new Set();
	if (!input) {
		return visited;
	}
	if (input instanceof Set) {
		for (const entry of input) {
			addVisitedEntry(visited, entry);
		}
		return visited;
	}
	if (typeof input[Symbol.iterator] === "function") {
		for (const entry of input) {
			addVisitedEntry(visited, entry);
		}
	}
	return visited;
}

function addVisitedEntry(visited, entry) {
	if (typeof entry !== "string") {
		return;
	}
	const id = entry.trim();
	if (id) {
		visited.add(id);
	}
}
