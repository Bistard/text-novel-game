import { createKey as createTransitionKey } from "../../state/transitionTracker.js";
import { SVG_NS, NODE_RADIUS, MIN_SCALE, MAX_SCALE } from "./storyGraphConfig.js";
import { computeLayout } from "./storyGraphLayout.js";
import { buildEdgePathData, computeVisibleViewportBounds, clamp } from "./storyGraphGeometry.js";
import {
	buildVisitedSet,
	buildVisitedTransitionSet,
	filterVisitedNodes,
} from "./storyGraphStateUtils.js";

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

