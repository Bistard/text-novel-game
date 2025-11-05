/**
 * Renders interactive choice buttons for the current branch.
 * @param {HTMLElement|null} container
 * @param {import("../../parser/types.js").StoryBranch} branch
 * @param {import("../../state/storyState.js").StoryState} state
 * @param {(choiceId: string) => void} onChoiceSelected
 */
export function renderChoices(container, branch, state, onChoiceSelected) {
	if (!container) return;
	container.innerHTML = "";

	if (!branch.choices.length) {
		const message = document.createElement("p");
		message.className = "muted";
		message.textContent = "This path has no further choices.";
		container.appendChild(message);
		return;
	}

	const handler = typeof onChoiceSelected === "function" ? onChoiceSelected : () => {};
	const gameState = state && typeof state.evaluateCondition === "function" ? state : null;
	let visibleChoices = 0;

	for (const choice of branch.choices) {
		if (gameState && choice.visibilityCondition && !gameState.evaluateCondition(choice.visibilityCondition)) {
			continue;
		}

		const button = document.createElement("button");
		button.type = "button";
		button.className = "choice-button";
		button.dataset.choiceId = choice.id;
		button.textContent = choice.text;

		const isEnabled =
			!gameState || !choice.validCondition || gameState.evaluateCondition(choice.validCondition);
		if (!isEnabled) {
			button.disabled = true;
			button.classList.add("choice-button-disabled");
		} else {
			button.addEventListener("click", () => handler(choice.id));
		}

		container.appendChild(button);
		visibleChoices += 1;
	}

	if (!visibleChoices) {
		const message = document.createElement("p");
		message.className = "muted";
		message.textContent = "No available choices.";
		container.appendChild(message);
	}
}
