import {
	NODE_RADIUS,
	HORIZONTAL_SPACING,
	VERTICAL_SPACING,
	HORIZONTAL_MARGIN,
	VERTICAL_MARGIN,
} from "./storyGraphConfig.js";

/**
 * Calculates graph layout positions for story branches and transitions.
 * @param {{ start?: string, branches?: Record<string, import("../../parser/types.js").StoryBranch> }} story
 */
export function computeLayout(story) {
	const branches = story.branches || {};
	const branchIds = Object.keys(branches);
	if (!branchIds.length) {
		return null;
	}

	const rawEdges = [];
	const parents = new Map();
	const children = new Map();
	const edgeCounts = new Map();

	/** @param {string} from @param {string|null|undefined} to */
	const trackEdge = (from, to) => {
		if (typeof from !== "string" || !from || !to || typeof to !== "string") {
			return;
		}
		const target = to.trim();
		if (!target || !branches[target]) {
			return;
		}
		const key = `${from}->${target}`;
		rawEdges.push({ from, to: target });
		edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
		if (!parents.has(target)) {
			parents.set(target, new Set());
		}
		parents.get(target).add(from);
		if (!children.has(from)) {
			children.set(from, new Set());
		}
		children.get(from).add(target);
	};

	for (const id of branchIds) {
		const branch = branches[id];
		if (!branch || !Array.isArray(branch.choices)) continue;
		for (const choice of branch.choices) {
			if (choice.next) {
				trackEdge(id, choice.next);
			}
			if (choice.roll) {
				trackEdge(id, choice.roll.ok);
				trackEdge(id, choice.roll.fail);
			}
		}
	}

	const edges = [];
	const parallelTracker = new Map();
	for (const edge of rawEdges) {
		const key = `${edge.from}->${edge.to}`;
		const total = edgeCounts.get(key) || 1;
		const index = parallelTracker.get(key) || 0;
		parallelTracker.set(key, index + 1);
		edges.push({
			from: edge.from,
			to: edge.to,
			parallelIndex: index,
			parallelCount: total,
		});
	}

	const depthMap = computeDepths(story.start, branches, children);
	resolveRemainingDepths(branchIds, depthMap, parents);

	const depthBuckets = new Map();
	let maxPerColumn = 1;
	for (const id of branchIds) {
		const depth = depthMap.get(id) ?? 0;
		if (!depthBuckets.has(depth)) {
			depthBuckets.set(depth, []);
		}
		const bucket = depthBuckets.get(depth);
		bucket.push(id);
		if (bucket.length > maxPerColumn) {
			maxPerColumn = bucket.length;
		}
	}

	const sortedDepths = Array.from(depthBuckets.keys()).sort((a, b) => a - b);
	const depthIndex = new Map(sortedDepths.map((depth, index) => [depth, index]));

	const nodes = [];
	const nodeMap = new Map();
	for (const depth of sortedDepths) {
		const bucket = depthBuckets.get(depth) || [];
		bucket.sort((a, b) => compareByParentPosition(a, b, parents, nodeMap));
		const columnIndex = depthIndex.get(depth) || 0;
		const columnX = HORIZONTAL_MARGIN + columnIndex * HORIZONTAL_SPACING;
		const columnHeight = (bucket.length - 1) * VERTICAL_SPACING;
		const totalHeight = (maxPerColumn - 1) * VERTICAL_SPACING;
		const startY = VERTICAL_MARGIN + (totalHeight - columnHeight) / 2;

		for (let index = 0; index < bucket.length; index += 1) {
			const id = bucket[index];
			const branch = branches[id];
			const y = startY + index * VERTICAL_SPACING;
			const labelSource = branch?.title || branch?.id || id;
			const label = shortenLabel(labelSource, 16);
			const tooltipParts = [];
			if (branch?.title) {
				tooltipParts.push(branch.title);
			}
			if (branch?.id && branch?.id !== branch?.title) {
				tooltipParts.push(`ID: ${branch.id}`);
			}
			const tooltip = tooltipParts.length ? tooltipParts.join(" | ") : labelSource;
			const node = {
				id,
				label,
				tooltip,
				x: columnX,
				y,
			};
			nodes.push(node);
			nodeMap.set(id, node);
		}
	}

	const width =
		HORIZONTAL_MARGIN * 2 +
		Math.max(0, sortedDepths.length - 1) * HORIZONTAL_SPACING +
		NODE_RADIUS * 2;
	const height =
		VERTICAL_MARGIN * 2 +
		Math.max(0, maxPerColumn - 1) * VERTICAL_SPACING +
		NODE_RADIUS * 2;

	return {
		nodes,
		nodeMap,
		edges,
		baseWidth: width,
		baseHeight: height,
	};
}

function computeDepths(startId, branches, childrenMap) {
	const depthMap = new Map();
	if (typeof startId === "string" && branches[startId]) {
		depthMap.set(startId, 0);
		const queue = [startId];
		while (queue.length) {
			const current = queue.shift();
			const depth = depthMap.get(current) || 0;
			const childSet = childrenMap.get(current);
			if (!childSet) continue;
			for (const child of childSet) {
				if (!branches[child]) continue;
				const nextDepth = depth + 1;
				if (!depthMap.has(child) || nextDepth < (depthMap.get(child) ?? Infinity)) {
					depthMap.set(child, nextDepth);
					queue.push(child);
				}
			}
		}
	}
	return depthMap;
}

function resolveRemainingDepths(branchIds, depthMap, parentsMap) {
	const pending = new Set();
	for (const id of branchIds) {
		if (!depthMap.has(id)) {
			pending.add(id);
		}
	}

	let updated = true;
	while (updated) {
		updated = false;
		for (const id of Array.from(pending)) {
			const parentSet = parentsMap.get(id);
			if (!parentSet || !parentSet.size) {
				continue;
			}
			let minParentDepth = Infinity;
			for (const parentId of parentSet) {
				if (!depthMap.has(parentId)) continue;
				const parentDepth = depthMap.get(parentId);
				if (parentDepth < minParentDepth) {
					minParentDepth = parentDepth;
				}
			}
			if (minParentDepth !== Infinity) {
				depthMap.set(id, minParentDepth + 1);
				pending.delete(id);
				updated = true;
			}
		}
	}

	const maxAssignedDepth = depthMap.size ? Math.max(...depthMap.values()) : 0;
	let fallbackDepth = maxAssignedDepth + 1;
	for (const id of pending) {
		depthMap.set(id, fallbackDepth);
		fallbackDepth += 1;
	}
	return depthMap;
}

function compareByParentPosition(a, b, parentsMap, nodeMap) {
	const ay = getAverageParentY(a, parentsMap, nodeMap);
	const by = getAverageParentY(b, parentsMap, nodeMap);
	const aFinite = Number.isFinite(ay);
	const bFinite = Number.isFinite(by);
	if (aFinite && bFinite && ay !== by) {
		return ay - by;
	}
	if (aFinite && !bFinite) {
		return -1;
	}
	if (!aFinite && bFinite) {
		return 1;
	}
	return a.localeCompare(b);
}

function getAverageParentY(id, parentsMap, nodeMap) {
	const parentSet = parentsMap.get(id);
	if (!parentSet || !parentSet.size) {
		return Number.POSITIVE_INFINITY;
	}
	let total = 0;
	let count = 0;
	for (const parentId of parentSet) {
		const parentNode = nodeMap.get(parentId);
		if (!parentNode) continue;
		total += parentNode.y;
		count += 1;
	}
	if (!count) {
		return Number.POSITIVE_INFINITY;
	}
	return total / count;
}

function shortenLabel(value, maxLength) {
	const text = typeof value === "string" ? value.trim() : "";
	if (!text) return "";
	if (text.length <= maxLength) return text;
	return `${text.slice(0, Math.max(1, maxLength - 3))}...`;
}
