import {
	buildVisitedSet,
	buildVisitedTransitionSet,
} from "./storyGraphStateUtils.js";
import { createKey as createTransitionKey } from "../../state/transitionTracker.js";

const MAX_LABEL_LENGTH = 16;

const NODE_CLASS_DEFS = {
	visited: "fill:#12374d,stroke:#63f5c0,stroke-width:2px",
	unvisited: "fill:#1a2242,stroke:#6c789f,stroke-width:2px",
	current: "stroke:#63f5c0,stroke-width:3px",
};

const LINK_STYLE_DEFS = {
	visited: "stroke:#63f5c0,stroke-width:2.4px,color:#63f5c0",
	locked: "stroke:#6c789f,stroke-width:2px,color:#b9c2f0,stroke-dasharray:6 6,opacity:0.85",
};

/**
 * Builds a Mermaid flowchart definition representing the story graph.
 * @param {{ story?: { branches?: Record<string, import("../../parser/types.js").StoryBranch> }, state?: import("../../state/storyState.js").StoryState|null, mode?: "visited"|"all", currentBranchId?: string|null }} options
 */
export function buildMermaidGraphDefinition({
	story = null,
	state = null,
	mode = "visited",
	currentBranchId = null,
	visitedBranches: providedVisitedBranches = null,
	visitedTransitions: providedVisitedTransitions = null,
} = {}) {
	if (!story || !story.branches) {
		return null;
	}
	const branches = story.branches;
	const allIds = Object.keys(branches);
	if (!allIds.length) {
		return null;
	}

	const visitedBranches = providedVisitedBranches ?? buildVisitedSet(state);
	const visitedTransitions = providedVisitedTransitions ?? buildVisitedTransitionSet(state);

	const visibleBranchIds =
		mode === "visited"
			? allIds.filter((id) => visitedBranches.has(id))
			: allIds.slice();

	if (!visibleBranchIds.length) {
		return null;
	}

	const sanitizedMap = new Map();
	const usedSanitized = new Set();
	const nodeMeta = new Map();
	const classAssignments = {
		visited: new Set(),
		unvisited: new Set(),
		current: new Set(),
	};

	for (const branchId of visibleBranchIds) {
		const sanitized = createMermaidId(branchId, usedSanitized);
		sanitizedMap.set(branchId, sanitized);

		const branch = branches[branchId];
		const labelSource = branch?.title || branch?.id || branchId;
		const label = shortenLabel(labelSource, MAX_LABEL_LENGTH);
		const tooltipParts = [];
		if (branch?.title) {
			tooltipParts.push(branch.title);
		}
		if (branch?.id && branch?.id !== branch?.title) {
			tooltipParts.push(`ID: ${branch.id}`);
		}
		const tooltip = tooltipParts.length ? tooltipParts.join(" | ") : labelSource;

		const statuses = new Set();
		if (visitedBranches.has(branchId)) {
			statuses.add("visited");
		} else {
			statuses.add("unvisited");
		}
		if (currentBranchId && branchId === currentBranchId) {
			statuses.add("current");
		}

		for (const status of statuses) {
			const target = classAssignments[status];
			if (target) {
				target.add(sanitized);
			}
		}

		nodeMeta.set(sanitized, { id: branchId, label, tooltip });
	}

	const edgeEntries = buildEdgeList(branches, sanitizedMap, mode, visitedTransitions);

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

	lines.push("  %% Edge Styles");
	const linkStyleLines = buildLinkStyleLines(edgeEntries);
	lines.push(...linkStyleLines);

	return {
		definition: lines.join("\n"),
		nodeMeta,
	};
}

function buildEdgeList(branches, sanitizedMap, mode, visitedTransitions) {
	const edges = [];
	const seen = new Set();
	for (const [branchId, branch] of Object.entries(branches)) {
		const from = sanitizedMap.get(branchId);
		if (!from || !branch?.choices) continue;
		for (const choice of branch.choices) {
			const targets = [];
			if (choice.next) {
				targets.push(choice.next);
			}
			if (choice.roll) {
				if (choice.roll.ok) targets.push(choice.roll.ok);
				if (choice.roll.fail) targets.push(choice.roll.fail);
			}
			for (const targetId of targets) {
				const to = sanitizedMap.get(targetId);
				if (!to) continue;
				const key = `${from}->${to}`;
				if (seen.has(key)) continue;

				const visited = visitedTransitions.has(createTransitionKey(branchId, targetId));
				if (mode === "visited" && !visited) {
					continue;
				}

				seen.add(key);
				edges.push({
					from,
					to,
					status: visited ? "visited" : "locked",
				});
			}
		}
	}
	return edges;
}

function buildClassDefLines(classAssignments) {
	const lines = [];
	const classDefs = [["default", "fill:#141a31,stroke:#49d2ff,stroke-width:2px"]];
	for (const [className, definition] of Object.entries(NODE_CLASS_DEFS)) {
		classDefs.push([className, definition]);
	}
	for (const [name, definition] of classDefs) {
		lines.push(`  classDef ${name} ${definition};`);
	}
	for (const [status, set] of Object.entries(classAssignments)) {
		if (!set || !set.size) continue;
		lines.push(`  class ${Array.from(set).join(",")} ${status};`);
	}
	return lines;
}

function buildLinkStyleLines(edgeEntries) {
	const lines = [];
	edgeEntries.forEach((edge, index) => {
		const style = LINK_STYLE_DEFS[edge.status];
		if (!style) return;
		lines.push(`  linkStyle ${index} ${style};`);
	});
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

function shortenLabel(text, maxLength) {
	const value = typeof text === "string" ? text.trim() : "";
	if (!value) return "";
	if (value.length <= maxLength) return value;
	return `${value.slice(0, Math.max(1, maxLength - 3))}...`;
}

function escapeMermaidLabel(value) {
	return String(value ?? "")
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\r?\n|\r/g, " ")
		.trim();
}
