import {
	NODE_RADIUS,
	HORIZONTAL_SPACING,
	EDGE_PARALLEL_OFFSET_STEP,
	EDGE_PARALLEL_ELBOW_STEP,
	VISIBLE_VIEWPORT_MIN_PADDING,
} from "./storyGraphConfig.js";

/**
 * Builds the SVG path for an edge between two nodes, including bounds metadata.
 */
export function buildEdgePathData(edge, fromNode, toNode) {
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

/**
 * Computes the viewport bounds that keep the provided nodes and edges visible.
 */
export function computeVisibleViewportBounds(nodes, edgeEntries) {
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

export function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
