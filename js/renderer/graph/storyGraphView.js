import { buildMermaidGraphDefinition } from "./storyGraphMermaid.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const MERMAID_MODULE_URL = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";

const MERMAID_CONFIG = {
	startOnLoad: false,
	securityLevel: "strict",
	theme: "base",
	flowchart: {
		htmlLabels: true,
		useMaxWidth: false,
		curve: "basis",
		padding: 16,
		nodeSpacing: 120,
		rankSpacing: 150,
	},
	themeVariables: {
		fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
		primaryColor: "rgba(20,26,49,0.85)",
		primaryBorderColor: "rgba(73,210,255,0.45)",
		primaryTextColor: "#f1f4ff",
		lineColor: "rgba(185,194,240,0.35)",
	},
	themeCSS: `
		.mermaid svg {
			background: transparent !important;
		}
		.mermaid svg .edgePath .path {
			stroke-linecap: round;
			stroke-linejoin: round;
		}
		.mermaid svg .marker {
			fill: rgba(73,210,255,0.45);
		}
		.mermaid svg .label,
		.mermaid svg .nodeLabel {
			fill: #f1f4ff;
			font-size: 12px;
			font-weight: 600;
		}
		.mermaid svg .edgeLabel {
			fill: #b9c2f0;
			font-size: 11px;
		}
	`,
};

let mermaidPromise = null;
let renderCounter = 0;

/**
 * Renders the story graph using Mermaid, preserving visited/full modes and the existing overlay chrome.
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

		this.scale = 1;
		this.story = null;
		this.currentBranchId = null;

		this.graphRoot = null;
		this.currentRenderToken = null;
		this.isRendering = false;

		this.panOrigin = null;
		this.activePointerId = null;

		this.handleWheel = this.handleWheel.bind(this);
		this.handlePointerDown = this.handlePointerDown.bind(this);
		this.handlePointerMove = this.handlePointerMove.bind(this);
		this.handlePointerUp = this.handlePointerUp.bind(this);

		if (this.toggleButton) {
			this.toggleButton.hidden = true;
			this.toggleButton.setAttribute("aria-hidden", "true");
			this.toggleButton.setAttribute("tabindex", "-1");
		}
		if (this.modeLabel) {
			this.modeLabel.textContent = "Story Map";
		}
		if (this.container) {
			this.container.addEventListener("wheel", this.handleWheel, { passive: false });
			this.container.addEventListener("pointerdown", this.handlePointerDown);
			this.container.addEventListener("pointermove", this.handlePointerMove);
			this.container.addEventListener("pointerup", this.handlePointerUp);
			this.container.addEventListener("pointercancel", this.handlePointerUp);
			this.container.addEventListener("pointerleave", this.handlePointerUp);
		}
	}

	/**
	 * Sets the story data used for layout and renders the graph.
	 * @param {{ start?: string, branches?: Record<string, import("../../parser/types.js").StoryBranch> }|null} story
	 */
	setStory(story) {
		if (!story || typeof story !== "object" || !story.branches) {
			this.story = null;
			this.clearGraph();
			this.showPlaceholder("Story map unavailable.");
			return;
		}
		this.story = story;
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
	update({ story = null, currentBranchId = null } = {}) {
		if (story && story !== this.story) {
			this.setStory(story);
		}
		this.currentBranchId = typeof currentBranchId === "string" ? currentBranchId : null;
		this.render();
	}

	refresh() {
		this.render();
	}

	render() {
		if (!this.container) {
			return;
		}
		if (!this.story || !this.story.branches) {
			this.clearGraph();
			this.showPlaceholder("Story map unavailable.");
			return;
		}

		const graph = buildMermaidGraphDefinition({
			story: this.story,
			currentBranchId: this.currentBranchId,
		});

		const hasDefinition = graph && typeof graph.definition === "string" && graph.definition.trim().length > 0;
		if (!hasDefinition) {
			this.clearGraph();
			this.showPlaceholder("Story map unavailable.");
			return;
		}

		this.hidePlaceholder();
		this.renderMermaidGraph(graph);
	}

	async renderMermaidGraph(graph) {
		const token = Symbol(`render-${renderCounter++}`);
		this.currentRenderToken = token;
		this.isRendering = true;

		let mermaid;
		try {
			mermaid = await loadMermaid();
		} catch (error) {
			if (this.currentRenderToken !== token) {
				return;
			}
			console.error("[StoryGraph] Unable to load Mermaid:", error);
			this.clearGraph();
			this.showPlaceholder("Story map unavailable.");
			this.isRendering = false;
			return;
		}

		let renderResult;
		try {
			renderResult = await mermaid.render(`storyGraph_${renderCounter}`, graph.definition);
		} catch (error) {
			if (this.currentRenderToken !== token) {
				return;
			}
			console.error("[StoryGraph] Mermaid rendering failed:", error);
			this.clearGraph();
			this.showPlaceholder("Story map unavailable.");
			this.isRendering = false;
			return;
		}

		if (this.currentRenderToken !== token) {
			this.isRendering = false;
			return;
		}

		this.ensureGraphRoot();
		if (!this.graphRoot) {
			this.isRendering = false;
			return;
		}

		this.graphRoot.innerHTML = renderResult.svg;
		this.applyScale();
		this.applyNodeTooltips(graph.nodeMeta);
		if (typeof renderResult.bindFunctions === "function") {
			renderResult.bindFunctions(this.graphRoot);
		}

		this.isRendering = false;
	}

	handleWheel(event) {
		if (!this.container) return;
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
		this.applyScale();

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

	applyScale() {
		if (!this.graphRoot) return;
		this.graphRoot.style.transformOrigin = "0 0";
		this.graphRoot.style.transform = `scale(${this.scale.toFixed(3)})`;
	}

	applyNodeTooltips(nodeMeta) {
		if (!nodeMeta || !nodeMeta.size || !this.graphRoot) {
			return;
		}
		const svg = this.graphRoot.querySelector("svg");
		if (!svg) return;
		const groups = svg.querySelectorAll("g.node");
		for (const group of groups) {
			const sanitizedId = normalizeRenderNodeId(group);
			if (!sanitizedId) continue;
			const meta = nodeMeta.get(sanitizedId);
			if (!meta || !meta.tooltip) continue;
			let title = group.querySelector("title");
			if (!title) {
				title = document.createElementNS(SVG_NS, "title");
				group.appendChild(title);
			}
			title.textContent = meta.tooltip;
		}
	}

	clearGraph() {
		if (this.graphRoot) {
			this.graphRoot.innerHTML = "";
		}
	}

	ensureGraphRoot() {
		if (this.graphRoot && this.graphRoot.isConnected) {
			return;
		}
		if (!this.container) {
			return;
		}
		const root = document.createElement("div");
		root.className = "graph-mermaid-root";
		root.setAttribute("data-renderer", "mermaid");
		this.container.appendChild(root);
		this.graphRoot = root;
		this.applyScale();
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
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function normalizeRenderNodeId(group) {
	if (!group) return "";
	const dataId = group.getAttribute("data-id");
	const rawId = dataId || group.getAttribute("id") || "";
	if (!rawId) return "";
	if (rawId.startsWith("flowchart-")) {
		return rawId.slice("flowchart-".length);
	}
	return rawId;
}

async function loadMermaid() {
	if (mermaidPromise) {
		return mermaidPromise;
	}
	mermaidPromise = import(MERMAID_MODULE_URL)
		.then((module) => {
			const mermaid = module?.default ?? module;
			if (!mermaid || typeof mermaid.initialize !== "function" || typeof mermaid.render !== "function") {
				throw new Error("Mermaid module does not expose the expected API.");
			}
			mermaid.initialize(MERMAID_CONFIG);
			return mermaid;
		})
		.catch((error) => {
			mermaidPromise = null;
			throw error;
		});
	return mermaidPromise;
}
