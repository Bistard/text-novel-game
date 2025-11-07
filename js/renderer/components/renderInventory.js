import { t } from "../../i18n/index.js";

/**
 * Renders the inventory list.
 * @param {HTMLElement|null} list
 * @param {import("../../state/storyState.js").StoryState} state
 */
export function renderInventory(list, state) {
	if (!list) return;
	list.innerHTML = "";

	const entries = Object.entries(state.inventory).filter(([, count]) => count > 0);
	if (!entries.length) {
		const placeholder = document.createElement("li");
		placeholder.textContent = t("inventory.empty");
		placeholder.className = "muted";
		list.appendChild(placeholder);
		return;
	}

	entries.sort((a, b) => a[0].localeCompare(b[0]));

	for (const [item, count] of entries) {
		const li = document.createElement("li");
		li.textContent = count === 1 ? item : `${item} ×${count}`;
		list.appendChild(li);
	}
}
