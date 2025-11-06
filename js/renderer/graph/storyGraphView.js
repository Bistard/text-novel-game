import { createKey as createTransitionKey, parseKey as parseTransitionKey } from "../../state/transitionTracker.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_RADIUS = 28;
const HORIZONTAL_SPACING = 240;
const VERTICAL_SPACING = 120;
const HORIZONTAL_MARGIN = 90;
const VERTICAL_MARGIN = 90;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const EDGE_PARALLEL_OFFSET_STEP = 90;
const EDGE_PARALLEL_ELBOW_STEP = 12;
const VISIBLE_VIEWPORT_MIN_PADDING = 80;

/**
 * Renders a left-to-right branch graph with pan and zoom controls.
 */
export class StoryGraphView {
	/**
	 * @param {{ container?: HTMLElement|null, toggleButton?: HTMLElement|null, modeLabel?: HTMLElement|null, placeholder?: HTMLElement|null }} options
	 */
	constructor({ container = null, toggleButton = null, modeLabel = null, placeholder = null } = {}) {
		this.container = container;
		this.toggleButton = toggleButton;
		this.modeLabel = modeLabel;
		this.placeholder = placeholder;

		this.mode = "visited";
		this.scale = 1;
		this.story = null;
		this.layout = null;
		this.svg = null;
		this.edgesGroup = null;
		this.nodesGroup = null;
		this.latestState = null;
		this.currentBranchId = null;
		this.panOrigin = null;
		this.activePointerId = null;

		this.handleToggle = this.handleToggle.bind(this);
		this.handleWheel = this.handleWheel.bind(this);
		this.handlePointerDown = this.handlePointerDown.bind(this);
		this.handlePointerMove = this.handlePointerMove.bind(this);
		this.handlePointerUp = this.handlePointerUp.bind(this);

		if (this.toggleButton) {
			this.toggleButton.addEventListener("click", this.handleToggle);
		}
		if (this.container) {
			this.container.addEventListener("wheel", this.handleWheel, { passive: false });
			this.container.addEventListener("pointerdown", this.handlePointerDown);
			this.container.addEventListener("pointermove", this.handlePointerMove);
			this.container.addEventListener("pointerup", this.handlePointerUp);
			this.container.addEventListener("pointercancel", this.handlePointerUp);
			this.container.addEventListener("pointerleave", this.handlePointerUp);
		}
		this.updateToggle();
	}

	/**
	 * Sets the story data used for layout and renders the graph.
	 * @param {{ start?: string, branches?: Record<string, import("../../parser/types.js").StoryBranch> }|null} story
	 */
	setStory(story) {
		if (!story || typeof story !== "object" || !story.branches) {
			this.story = null;
			this.layout = null;
			this.destroySvg();
			this.showPlaceholder("Story map unavailable.");
			return;
		}
		this.story = story;
		this.layout = computeLayout(story);
		this.scale = 1;
		if (this.container) {
			this.container.scrollLeft = 0;
			this.container.scrollTop = 0;
		}
		this.render();
	}

	/**
	 * Updates the graph with the latest state data.
	 * @param {{ story?: { start?: string, branches?: Record<string, import("../../parser/types.js").StoryBranch> }, state?: import("../../state/storyState.js").StoryState|null, currentBranchId?: string|null }} payload
	 */
	update({ story = null, state = null, currentBranchId = null } = {}) {
		if (story && story !== this.story) {
			this.setStory(story);
		}
		this.latestState = state || null;
		this.currentBranchId = typeof currentBranchId === "string" ? currentBranchId : null;
		this.render();
	}

	/**
	 * Explicitly sets the current mode (visited-only or full map).
	 * @param {"visited"|"all"} mode
	 */
	setMode(mode) {
		if (mode !== "visited" && mode !== "all") {
			return;
		}
		if (this.mode === mode) {
			return;
		}
		this.mode = mode;
		this.updateToggle();
		this.render();
	}

	refresh() {
		this.render();
	}

	toggleMode() {
		this.setMode(this.mode === "visited" ? "all" : "visited");
	}

	handleToggle() {
		this.toggleMode();
	}

	render() {
		if (!this.container || !this.layout) {
			this.destroySvg();
			this.showPlaceholder("Story map unavailable.");
			return;
		}

		const visitedBranchIds = buildVisitedSet(this.latestState);
		const visitedTransitions = buildVisitedTransitionSet(this.latestState);
		const visibleNodes = this.mode === "visited" ? filterVisitedNodes(this.layout.nodes, visitedBranchIds) : this.layout.nodes;

		if (!visibleNodes.length) {
			const message =
				this.mode === "visited"
					? "Play the story to reveal your progress."
					: "Story map unavailable.";
			this.destroySvg();
			this.showPlaceholder(message);
			return;
		}

		this.hidePlaceholder();
		this.ensureSvg();
		if (!this.svg || !this.edgesGroup || !this.nodesGroup) {
			return;
		}

		this.updateToggle();
		const edgeEntries = this.buildEdgeRenderEntries(visibleNodes, visitedTransitions);
		const defaultViewport = {
			minX: 0,
			minY: 0,
			width: this.layout.baseWidth,
			height: this.layout.baseHeight,
		};
		const viewport =
			this.mode === "visited"
				? computeVisibleViewportBounds(visibleNodes, edgeEntries) || defaultViewport
				: defaultViewport;
		const width = Math.max(1, viewport.width);
		const height = Math.max(1, viewport.height);
		const scaledWidth = width * this.scale;
		const scaledHeight = height * this.scale;
		this.svg.setAttribute("width", scaledWidth.toFixed(2));
		this.svg.setAttribute("height", scaledHeight.toFixed(2));
		this.svg.setAttribute("viewBox", `${viewport.minX} ${viewport.minY} ${width} ${height}`);
		this.svg.style.width = `${scaledWidth}px`;
		this.svg.style.height = `${scaledHeight}px`;

		this.renderEdges(edgeEntries);
		this.renderNodes(visibleNodes, visitedBranchIds);
	}

	renderEdges(edgeEntries) {
		if (!this.edgesGroup) return;
		this.edgesGroup.innerHTML = "";
		for (const entry of edgeEntries) {
			const path = document.createElementNS(SVG_NS, "path");
			path.classList.add("graph-edge", entry.status);
			path.setAttribute("d", entry.d);
			this.edgesGroup.appendChild(path);
		}
	}

	buildEdgeRenderEntries(visibleNodes, visitedTransitions) {
		if (!this.layout) {
			return [];
		}
		const entries = [];
		const visibleSet = new Set(visibleNodes.map((node) => node.id));
		const nodeMap = this.layout.nodeMap;
		const requireVisible = this.mode === "visited";

		for (const edge of this.layout.edges) {
			const key = createTransitionKey(edge.from, edge.to);
			const visited = visitedTransitions.has(key);
			if (requireVisible) {
				if (!visited) continue;
				if (!visibleSet.has(edge.from) || !visibleSet.has(edge.to)) continue;
			}
			const fromNode = nodeMap.get(edge.from);
			const toNode = nodeMap.get(edge.to);
			if (!fromNode || !toNode) {
				continue;
			}
			const status = visited ? "visited" : "locked";
			if (requireVisible && status !== "visited") {
				continue;
			}
			const pathData = buildEdgePathData(edge, fromNode, toNode);
			if (!pathData) continue;
			entries.push({
				status,
				d: pathData.d,
				bounds: pathData.bounds,
			});
		}
		return entries;
	}

	renderNodes(nodes, visitedBranches) {
		if (!this.nodesGroup) return;
		this.nodesGroup.innerHTML = "";
		for (const node of nodes) {
			const group = document.createElementNS(SVG_NS, "g");
			group.classList.add("graph-node");
			if (visitedBranches.has(node.id)) {
				group.classList.add("visited");
			} else {
				group.classList.add("unvisited");
			}
			if (this.currentBranchId && node.id === this.currentBranchId) {
				group.classList.add("current");
			}

			const circle = document.createElementNS(SVG_NS, "circle");
			circle.setAttribute("cx", node.x);
			circle.setAttribute("cy", node.y);
			circle.setAttribute("r", NODE_RADIUS);
			group.appendChild(circle);

			const text = document.createElementNS(SVG_NS, "text");
			text.setAttribute("x", node.x);
			text.setAttribute("y", node.y);
			text.classList.add("graph-node-label");
			text.textContent = node.label;
			group.appendChild(text);

			if (node.tooltip) {
				const title = document.createElementNS(SVG_NS, "title");
				title.textContent = node.tooltip;
				group.appendChild(title);
			}

			this.nodesGroup.appendChild(group);
		}
	}

	handleWheel(event) {
		if (!this.container || !this.layout) return;
		if (!event.ctrlKey) {
			return;
		}
		event.preventDefault();

		const direction = event.deltaY;
		const scaleFactor = direction > 0 ? 0.9 : 1.1;
		const nextScale = clamp(this.scale * scaleFactor, MIN_SCALE, MAX_SCALE);
		if (Math.abs(nextScale - this.scale) < 0.001) {
			return;
		}

		const rect = this.container.getBoundingClientRect();
		const offsetX = event.clientX - rect.left + this.container.scrollLeft;
		const offsetY = event.clientY - rect.top + this.container.scrollTop;
		const relativeX = offsetX / this.scale;
		const relativeY = offsetY / this.scale;

		this.scale = nextScale;
		this.render();

		const newScrollLeft = relativeX * this.scale - (event.clientX - rect.left);
		const newScrollTop = relativeY * this.scale - (event.clientY - rect.top);

		this.container.scrollLeft = Math.max(0, newScrollLeft);
		this.container.scrollTop = Math.max(0, newScrollTop);
	}

	handlePointerDown(event) {
		if (!this.container) return;
		if (event.button !== 0) return;
		this.panOrigin = {
			x: event.clientX,
			y: event.clientY,
			scrollLeft: this.container.scrollLeft,
			scrollTop: this.container.scrollTop,
		};
		this.activePointerId = event.pointerId;
		this.container.classList.add("is-panning");
		if (typeof this.container.setPointerCapture === "function") {
			try {
				this.container.setPointerCapture(event.pointerId);
			} catch (_) {
				// ignore
			}
		}
		event.preventDefault();
	}

	handlePointerMove(event) {
		if (!this.container) return;
		if (this.activePointerId == null || this.panOrigin == null) return;
		if (event.pointerId !== this.activePointerId) return;
		event.preventDefault();
		const deltaX = event.clientX - this.panOrigin.x;
		const deltaY = event.clientY - this.panOrigin.y;
		this.container.scrollLeft = this.panOrigin.scrollLeft - deltaX;
		this.container.scrollTop = this.panOrigin.scrollTop - deltaY;
	}

	handlePointerUp(event) {
		if (!this.container) return;
		if (this.activePointerId == null || event.pointerId !== this.activePointerId) {
			return;
		}
		this.activePointerId = null;
		this.panOrigin = null;
		this.container.classList.remove("is-panning");
		if (typeof this.container.releasePointerCapture === "function") {
			try {
				this.container.releasePointerCapture(event.pointerId);
			} catch (_) {
				// ignore
			}
		}
	}

	ensureSvg() {
		if (this.svg || !this.container) {
			return;
		}
		const svg = document.createElementNS(SVG_NS, "svg");
		svg.classList.add("graph-svg");
		svg.setAttribute("aria-hidden", "true");

		const edgesGroup = document.createElementNS(SVG_NS, "g");
		const nodesGroup = document.createElementNS(SVG_NS, "g");
		edgesGroup.setAttribute("data-layer", "edges");
		nodesGroup.setAttribute("data-layer", "nodes");

		svg.appendChild(edgesGroup);
		svg.appendChild(nodesGroup);
		this.container.appendChild(svg);

		this.svg = svg;
		this.edgesGroup = edgesGroup;
		this.nodesGroup = nodesGroup;
	}

	destroySvg() {
		if (this.svg && this.container && this.container.contains(this.svg)) {
			this.container.removeChild(this.svg);
		}
		this.svg = null;
		this.edgesGroup = null;
		this.nodesGroup = null;
	}

	showPlaceholder(message) {
		if (this.placeholder) {
			this.placeholder.hidden = false;
			if (typeof message === "string") {
				this.placeholder.textContent = message;
			}
		}
	}

	hidePlaceholder() {
		if (this.placeholder) {
			this.placeholder.hidden = true;
		}
	}

	updateToggle() {
		if (this.toggleButton) {
			const pressed = this.mode === "all";
			this.toggleButton.setAttribute("aria-pressed", pressed ? "true" : "false");
			this.toggleButton.textContent = pressed ? "Show Visited Only" : "Show Full Map";
		}
		if (this.modeLabel) {
			this.modeLabel.textContent = this.mode === "all" ? "Full Story" : "Visited Branches";
		}
	}
}

function buildEdgePathData(edge, fromNode, toNode) {
	const fromX = fromNode.x;
	const fromY = fromNode.y;
	const toX = toNode.x;
	const toY = toNode.y;
	const parallelIndex = edge?.parallelIndex ?? 0;
	const parallelCount = edge?.parallelCount ?? 1;
	const center = (parallelCount - 1) / 2;
	const offset = parallelCount > 1 ? (parallelIndex - center) * EDGE_PARALLEL_OFFSET_STEP : 0;
	const padding = NODE_RADIUS + 12;
	const deltaX = toX - fromX;
	let elbowX;

	if (deltaX >= 0) {
		const elbowMin = fromX + Math.max(40, deltaX * 0.25);
		const elbowMax = toX - padding;
		if (elbowMax <= elbowMin) {
			elbowX = fromX + Math.max(40, deltaX * 0.5);
		} else {
			const preferred = fromX + Math.max(60, Math.min(deltaX * 0.6, HORIZONTAL_SPACING * 0.75));
			elbowX = clamp(preferred, elbowMin, elbowMax);
		}
		if (parallelCount > 1 && elbowMax > elbowMin) {
			const elbowShift = (parallelIndex - center) * EDGE_PARALLEL_ELBOW_STEP;
			elbowX = clamp(elbowX + elbowShift, elbowMin, elbowMax);
		}
	} else {
		const absDeltaX = Math.abs(deltaX);
		const elbowMax = fromX - Math.max(40, absDeltaX * 0.25);
		const elbowMin = toX + padding;
		if (elbowMax <= elbowMin) {
			elbowX = fromX - Math.max(40, absDeltaX * 0.5);
		} else {
			const preferred = fromX - Math.max(60, Math.min(absDeltaX * 0.6, HORIZONTAL_SPACING * 0.75));
			elbowX = clamp(preferred, elbowMin, elbowMax);
		}
		if (parallelCount > 1 && elbowMax > elbowMin) {
			const elbowShift = (parallelIndex - center) * EDGE_PARALLEL_ELBOW_STEP;
			elbowX = clamp(elbowX + elbowShift, elbowMin, elbowMax);
		}
	}

	const startY = fromY + offset;
	const endY = toY + offset;
	const pathSegments = [`M ${fromX} ${fromY}`];
	if (offset !== 0) {
		pathSegments.push(`L ${fromX} ${startY}`);
	}
	pathSegments.push(`L ${elbowX} ${startY}`);
	if (startY !== endY) {
		pathSegments.push(`L ${elbowX} ${endY}`);
	}
	pathSegments.push(`L ${toX} ${endY}`);
	if (offset !== 0) {
		pathSegments.push(`L ${toX} ${toY}`);
	}

	const bounds = {
		minX: Math.min(fromX, elbowX, toX),
		maxX: Math.max(fromX, elbowX, toX),
		minY: Math.min(fromY, startY, endY, toY),
		maxY: Math.max(fromY, startY, endY, toY),
	};

	return {
		d: pathSegments.join(" "),
		bounds,
	};
}

function computeVisibleViewportBounds(nodes, edgeEntries) {
	if (!Array.isArray(nodes) || !nodes.length) {
		return null;
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const node of nodes) {
		minX = Math.min(minX, node.x - NODE_RADIUS);
		maxX = Math.max(maxX, node.x + NODE_RADIUS);
		minY = Math.min(minY, node.y - NODE_RADIUS);
		maxY = Math.max(maxY, node.y + NODE_RADIUS);
	}

	for (const entry of edgeEntries) {
		const bounds = entry?.bounds;
		if (!bounds) continue;
		minX = Math.min(minX, bounds.minX);
		minY = Math.min(minY, bounds.minY);
		maxX = Math.max(maxX, bounds.maxX);
		maxY = Math.max(maxY, bounds.maxY);
	}

	if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
		return null;
	}

	const paddingX = Math.max(VISIBLE_VIEWPORT_MIN_PADDING, NODE_RADIUS + EDGE_PARALLEL_ELBOW_STEP * 2);
	const paddingY = Math.max(VISIBLE_VIEWPORT_MIN_PADDING, NODE_RADIUS + EDGE_PARALLEL_OFFSET_STEP * 2);

	minX -= paddingX;
	maxX += paddingX;
	minY -= paddingY;
	maxY += paddingY;

	const width = Math.max(1, maxX - minX);
	const height = Math.max(1, maxY - minY);
	return {
		minX,
		minY,
		width,
		height,
	};
}

function computeLayout(story) {
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
			const tooltip = tooltipParts.length ? tooltipParts.join(" • ") : labelSource;
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
				if (!depthMap.has(child) || nextDepth < depthMap.get(child)) {
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
	if (!pending.size) {
		return depthMap;
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

function buildVisitedSet(state) {
	const visited = new Set();
	if (!state || typeof state.getVisitedBranches !== "function") {
		return visited;
	}
	for (const id of state.getVisitedBranches()) {
		if (typeof id === "string" && id.trim()) {
			visited.add(id.trim());
		}
	}
	return visited;
}

function buildVisitedTransitionSet(state) {
	const transitions = new Set();
	if (!state || typeof state.getVisitedTransitions !== "function") {
		return transitions;
	}
	const entries = state.getVisitedTransitions();
	if (!Array.isArray(entries)) {
		return transitions;
	}
	for (const entry of entries) {
		if (typeof entry === "string") {
			const parsed = parseTransitionKey(entry);
			if (parsed) {
				transitions.add(createTransitionKey(parsed.from, parsed.to));
			}
			continue;
		}
		if (!entry || typeof entry !== "object") continue;
		const from = typeof entry.from === "string" ? entry.from.trim() : "";
		const to = typeof entry.to === "string" ? entry.to.trim() : "";
		if (!from || !to) continue;
		transitions.add(createTransitionKey(from, to));
	}
	return transitions;
}

function filterVisitedNodes(nodes, visited) {
	const filtered = [];
	for (const node of nodes) {
		if (visited.has(node.id)) {
			filtered.push(node);
		}
	}
	return filtered;
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
