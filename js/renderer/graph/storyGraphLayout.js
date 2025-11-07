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

	const depthMap = computeDepths(branchIds, story.start, parents, children);

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

function computeDepths(branchIds, startId, parentsMap, childrenMap) {
	const depthMap = new Map();
	if (!branchIds.length) {
		return depthMap;
	}

	const { componentIndex, components } = computeStronglyConnectedComponents(branchIds, childrenMap);
	const componentCount = components.length;
	const componentParents = Array.from({ length: componentCount }, () => new Set());
	const componentChildren = Array.from({ length: componentCount }, () => new Set());

	for (const [childId, parentSet] of parentsMap) {
		const childComponent = componentIndex.get(childId);
		if (childComponent == null) continue;
		for (const parentId of parentSet) {
			const parentComponent = componentIndex.get(parentId);
			if (parentComponent == null || parentComponent === childComponent) continue;
			componentParents[childComponent].add(parentComponent);
			componentChildren[parentComponent].add(childComponent);
		}
	}

	for (const id of branchIds) {
		const fromComponent = componentIndex.get(id);
		if (fromComponent == null) continue;
		const childSet = childrenMap.get(id);
		if (!childSet) continue;
		for (const child of childSet) {
			const toComponent = componentIndex.get(child);
			if (toComponent == null || toComponent === fromComponent) continue;
			componentParents[toComponent].add(fromComponent);
			componentChildren[fromComponent].add(toComponent);
		}
	}

	const indegree = componentParents.map((set) => set.size);
	const pendingDepth = new Array(componentCount).fill(0);
	const componentDepth = new Array(componentCount).fill(0);
	const queue = [];
	const processed = new Set();
	const componentOrder = [];

	for (let componentId = 0; componentId < componentCount; componentId += 1) {
		if (indegree[componentId] === 0) {
			queue.push(componentId);
		}
	}

	while (queue.length) {
		const componentId = queue.shift();
		componentOrder.push(componentId);
		const parents = componentParents[componentId];
		let depth = pendingDepth[componentId];
		if (parents.size) {
			for (const parentId of parents) {
				const parentDepth = componentDepth[parentId];
				if (parentDepth + 1 > depth) {
					depth = parentDepth + 1;
				}
			}
		}
		componentDepth[componentId] = depth;
		processed.add(componentId);

		for (const childComponent of componentChildren[componentId]) {
			if (pendingDepth[childComponent] < depth + 1) {
				pendingDepth[childComponent] = depth + 1;
			}
			indegree[childComponent] -= 1;
			if (indegree[childComponent] === 0) {
				queue.push(childComponent);
			}
		}
	}

	if (processed.size < componentCount) {
		for (let componentId = 0; componentId < componentCount; componentId += 1) {
			if (processed.has(componentId)) continue;
			componentOrder.push(componentId);
			let depth = pendingDepth[componentId];
			const parents = componentParents[componentId];
			if (parents.size) {
				for (const parentId of parents) {
					const parentDepth = componentDepth[parentId] ?? 0;
					if (parentDepth + 1 > depth) {
						depth = parentDepth + 1;
					}
				}
			}
			if (!Number.isFinite(depth)) {
				depth = 0;
			}
			componentDepth[componentId] = depth;
		}
	}

	// Shift components forward so they sit immediately before their earliest child.
	for (let index = componentOrder.length - 1; index >= 0; index -= 1) {
		const componentId = componentOrder[index];
		const children = componentChildren[componentId];
		if (!children.size) continue;
		let minChildDepth = Infinity;
		for (const childId of children) {
			const depth = componentDepth[childId];
			if (depth < minChildDepth) {
				minChildDepth = depth;
			}
		}
		if (minChildDepth === Infinity) {
			continue;
		}
		const candidate = minChildDepth - 1;
		if (candidate > componentDepth[componentId]) {
			componentDepth[componentId] = candidate;
		}
	}

	for (const id of branchIds) {
		const index = componentIndex.get(id);
		const depth = index == null ? 0 : componentDepth[index] ?? 0;
		depthMap.set(id, depth);
	}

	if (typeof startId === "string" && depthMap.has(startId)) {
		const shift = depthMap.get(startId) || 0;
		if (shift) {
			for (const [id, depth] of depthMap) {
				depthMap.set(id, depth - shift);
			}
		}
	}

	return depthMap;
}

function computeStronglyConnectedComponents(branchIds, childrenMap) {
	const indexMap = new Map();
	const lowLinkMap = new Map();
	const componentIndex = new Map();
	const stack = [];
	const onStack = new Set();
	const components = [];
	let indexCounter = 0;

	const visit = (id) => {
		indexMap.set(id, indexCounter);
		lowLinkMap.set(id, indexCounter);
		indexCounter += 1;
		stack.push(id);
		onStack.add(id);

		const neighbors = childrenMap.get(id);
		if (neighbors) {
			for (const neighbor of neighbors) {
				if (!indexMap.has(neighbor)) {
					visit(neighbor);
					const currentLowlink = lowLinkMap.get(id);
					const neighborLowlink = lowLinkMap.get(neighbor);
					if (neighborLowlink < currentLowlink) {
						lowLinkMap.set(id, neighborLowlink);
					}
				} else if (onStack.has(neighbor)) {
					const currentLowlink = lowLinkMap.get(id);
					const neighborIndex = indexMap.get(neighbor);
					if (neighborIndex < currentLowlink) {
						lowLinkMap.set(id, neighborIndex);
					}
				}
			}
		}

		if (lowLinkMap.get(id) === indexMap.get(id)) {
			const component = [];
			while (stack.length) {
				const member = stack.pop();
				onStack.delete(member);
				componentIndex.set(member, components.length);
				component.push(member);
				if (member === id) {
					break;
				}
			}
			components.push(component);
		}
	};

	for (const id of branchIds) {
		if (!indexMap.has(id)) {
			visit(id);
		}
	}

	return { componentIndex, components };
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
