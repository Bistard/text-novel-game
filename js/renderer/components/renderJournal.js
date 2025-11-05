/**
 * Renders the journal history.
 * @param {HTMLElement|null} list
 * @param {import("../../state/storyState.js").StoryState} state
 */
export function renderJournal(list, state) {
	if (!list) return;
	list.innerHTML = "";

	if (!state.journal.length) {
		const placeholder = document.createElement("li");
		placeholder.className = "muted";
		placeholder.textContent = "No actions recorded yet.";
		list.appendChild(placeholder);
		return;
	}

	for (const entry of state.journal.slice().reverse()) {
		const li = document.createElement("li");
		li.textContent = entry;
		list.appendChild(li);
	}
}
