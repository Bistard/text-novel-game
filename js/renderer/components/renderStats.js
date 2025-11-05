import { formatLabel } from "../../storyUtilities.js";

/**
 * Renders stat values into the definition list container.
 * @param {HTMLElement|null} container
 * @param {import("../../state/storyState.js").StoryState} state
 */
export function renderStats(container, state) {
	if (!container) return;
	container.innerHTML = "";

	const entries = Object.entries(state.stats);
	if (!entries.length) {
		const placeholder = document.createElement("div");
		placeholder.className = "muted";
		placeholder.textContent = "No stats configured.";
		container.appendChild(placeholder);
		return;
	}

	entries.sort((a, b) => a[0].localeCompare(b[0]));

	for (const [stat, value] of entries) {
		const dt = document.createElement("dt");
		dt.textContent = formatLabel(stat);
		container.appendChild(dt);

		const dd = document.createElement("dd");
		dd.textContent = String(value);
		container.appendChild(dd);
	}
}
