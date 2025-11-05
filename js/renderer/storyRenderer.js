import { DiceOverlay } from "./overlay/diceOverlay.js";
import { ChangeOverlay } from "./overlay/changeOverlay.js";
import { chunkParagraphs } from "../storyUtilities.js";
import { TextAnimator } from "./textAnimator.js";
import { renderChoices } from "./components/renderChoices.js";
import { renderStats } from "./components/renderStats.js";
import { renderInventory } from "./components/renderInventory.js";
import { renderJournal } from "./components/renderJournal.js";
import { renderSystemMessages } from "./components/renderSystemMessages.js";
import { renderTitle, DOCUMENT_SUFFIX } from "./components/renderTitle.js";

/**
 * Handles DOM updates for the interactive story.
 */
export class StoryRenderer {
	/**
	 * @param {object} elements
	 * @param {HTMLElement} [elements.nodeTitle]
	 * @param {HTMLElement} [elements.storyText]
	 * @param {HTMLElement} [elements.choices]
	 * @param {HTMLElement} [elements.stats]
	 * @param {HTMLElement} [elements.journal]
	 * @param {HTMLElement} [elements.inventory]
	 * @param {HTMLElement} [elements.systemMessages]
	 * @param {HTMLElement} [elements.titleElement]
	 * @param {HTMLElement} [elements.skipButton]
	 */
	constructor(elements) {
		this.elements = elements;
		this.currentAnimation = null;
		this.textAnimator = new TextAnimator({
			prefersReducedMotion: () => this.prefersReducedMotion(),
		});
		this.diceOverlay = new DiceOverlay({ prefersReducedMotion: this.prefersReducedMotion.bind(this) });
		this.changeOverlay = new ChangeOverlay({ prefersReducedMotion: this.prefersReducedMotion.bind(this) });
		this.handleSkipButtonClick = this.handleSkipButtonClick.bind(this);
		if (this.elements.skipButton) {
			this.elements.skipButton.addEventListener("click", this.handleSkipButtonClick);
		}
	}

	/**
	 * @param {import("../parser/types.js").StoryBranch|null} branch
	 * @param {import("../state/storyState.js").StoryState} state
	 * @param {(choiceId: string) => void} onChoiceSelected
	 */
	render(branch, state, onChoiceSelected) {
		this.cancelCurrentAnimation();

		if (!branch) {
			this.renderEmptyState(state);
			return;
		}

		renderTitle({ nodeTitle: this.elements.nodeTitle, titleElement: this.elements.titleElement }, branch);
		this.clearChoices();
		renderStats(this.elements.stats, state);
		renderInventory(this.elements.inventory, state);
		renderJournal(this.elements.journal, state);
		renderSystemMessages(this.elements.systemMessages, state);

		this.renderStory(branch, () => {
			renderChoices(this.elements.choices, branch, state, onChoiceSelected);
		});

		this.syncSkipButtonState();
	}

	clearChoices() {
		const container = this.elements.choices;
		if (container) {
			container.innerHTML = "";
		}
	}

	cancelCurrentAnimation() {
		if (this.currentAnimation && typeof this.currentAnimation.cancel === "function") {
			this.currentAnimation.cancel();
		}
		this.setSkipButtonVisibility(false);
		this.currentAnimation = null;
	}

	handleSkipButtonClick() {
		if (this.currentAnimation && typeof this.currentAnimation.skip === "function") {
			this.currentAnimation.skip();
		}
	}

	setSkipButtonVisibility(isVisible) {
		const button = this.elements.skipButton;
		if (!button) return;
		if (isVisible) {
			button.hidden = false;
			button.disabled = false;
		} else {
			button.hidden = true;
			button.disabled = true;
		}
	}

	/** Ensures the skip button reflects whether an animation is active. */
	syncSkipButtonState() {
		this.setSkipButtonVisibility(Boolean(this.currentAnimation));
	}

	/**
	 * @param {import("../parser/types.js").StoryBranch} branch
	 * @param {() => void} onComplete
	 */
	renderStory(branch, onComplete) {
		const container = this.elements.storyText;
		const paragraphs = chunkParagraphs(branch.description);

		const { controller } = this.textAnimator.animate(
			{
				container,
				description: branch.description,
				paragraphs,
			},
			{
				onAfterFinish: ({ cancelled }) => {
					if (this.currentAnimation === controller) {
						this.currentAnimation = null;
					}
					this.setSkipButtonVisibility(false);
					if (!cancelled && typeof onComplete === "function") {
						onComplete();
					}
				},
			}
		);

		if (!controller) {
			this.currentAnimation = null;
			this.setSkipButtonVisibility(false);
			return;
		}

		this.currentAnimation = controller;
		this.setSkipButtonVisibility(true);
		controller.start();
	}

	/**
	 * Displays the dice roll overlay, plays the animation, and waits for user confirmation.
	 * @param {import("../storyUtilities.js").RollResult} result
	 * @param {{ duration?: number, statEffects?: { stat: string, delta: number }[] }} [options]
	 */
	async showRollResult(result, options = {}) {
		this.cancelCurrentAnimation();
		this.setSkipButtonVisibility(false);
		if (!result || !this.diceOverlay) return;
		await this.diceOverlay.show(result, options);
	}

	/**
	 * Displays the overlay summarising stat or inventory updates.
	 * @param {{ stats?: { stat: string, delta: number }[], inventory?: { item: string, delta: number }[], sourceLabel?: string|null }} [changes]
	 */
	async showChangeSummary(changes = {}) {
		this.cancelCurrentAnimation();
		this.setSkipButtonVisibility(false);
		if (!this.changeOverlay) return;
		await this.changeOverlay.show(changes);
	}

	prefersReducedMotion() {
		const media =
			typeof globalThis.matchMedia === "function" ? globalThis.matchMedia("(prefers-reduced-motion: reduce)") : null;
		return Boolean(media && media.matches);
	}

	/**
	 * @param {import("../state/storyState.js").StoryState} state
	 */
	renderEmptyState(state) {
		this.setSkipButtonVisibility(false);
		if (this.elements.nodeTitle) {
			this.elements.nodeTitle.textContent = "Story unavailable";
		}
		if (this.elements.storyText) {
			this.elements.storyText.textContent = state.systemError
				? state.systemError
				: "Unable to locate the next branch.";
		}
		if (this.elements.choices) {
			this.elements.choices.innerHTML = "";
		}

		renderStats(this.elements.stats, state);
		renderInventory(this.elements.inventory, state);
		renderJournal(this.elements.journal, state);
		renderSystemMessages(this.elements.systemMessages, state);
		document.title = `Story unavailable — ${DOCUMENT_SUFFIX}`;
	}
}
