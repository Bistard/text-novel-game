import { buildRollSummary } from "../../storyUtilities.js";

/**
 * Renders system messages (errors or recent rolls).
 * @param {HTMLElement|null} container
 * @param {import("../../state/storyState.js").StoryState} state
 */
export function renderSystemMessages(container, state) {
	if (!container) return;
	container.innerHTML = "";

	if (state.systemError) {
		const p = document.createElement("p");
		p.className = "roll-result failure";
		p.textContent = state.systemError;
		container.appendChild(p);
		return;
	}

	const rollResult = state.lastRoll;
	if (!rollResult) return;

	const p = document.createElement("p");
	p.className = `roll-result ${rollResult.success ? "success" : "failure"}`;
	p.textContent = buildRollSummary(rollResult);
	container.appendChild(p);
}
