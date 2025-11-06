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
import { StoryGraphView } from "./graph/storyGraphView.js";

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
	 * @param {HTMLElement} [elements.skipToggle]
	 * @param {HTMLElement} [elements.graphContainer]
	 * @param {HTMLElement} [elements.graphToggle]
	 * @param {HTMLElement} [elements.graphModeLabel]
	 * @param {HTMLElement} [elements.graphPlaceholder]
	 */
	constructor(elements) {
		this.elements = elements;
		this.currentAnimation = null;
		this.story = null;
		this.textAnimator = new TextAnimator({
			prefersReducedMotion: () => this.prefersReducedMotion(),
		});
		this.diceOverlay = new DiceOverlay({ prefersReducedMotion: this.prefersReducedMotion.bind(this) });
		this.changeOverlay = new ChangeOverlay({ prefersReducedMotion: this.prefersReducedMotion.bind(this) });
		this.handleSkipButtonClick = this.handleSkipButtonClick.bind(this);
		this.handleSkipToggleClick = this.handleSkipToggleClick.bind(this);
		this.alwaysSkipText = false;
		if (this.elements.skipButton) {
			this.elements.skipButton.addEventListener("click", this.handleSkipButtonClick);
		}
		if (this.elements.skipToggle) {
			this.elements.skipToggle.addEventListener("click", this.handleSkipToggleClick);
			this.syncSkipToggleState();
		}
		this.graphView = null;
		if (this.elements.graphContainer) {
			this.graphView = new StoryGraphView({
				container: this.elements.graphContainer,
				toggleButton: this.elements.graphToggle,
				modeLabel: this.elements.graphModeLabel,
				placeholder: this.elements.graphPlaceholder,
			});
		}
	}

	setStory(story) {
		this.story = story || null;
		if (this.graphView) {
			this.graphView.setStory(this.story);
		}
	}

	refreshGraphView() {
		if (this.graphView) {
			this.graphView.refresh();
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
		if (this.graphView) {
			this.graphView.update({
				story: this.story,
				state,
				currentBranchId: branch.id,
			});
		}
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

	handleSkipToggleClick() {
		this.setAlwaysSkipText(!this.alwaysSkipText);
	}

	setAlwaysSkipText(shouldAlwaysSkip) {
		if (this.alwaysSkipText === shouldAlwaysSkip) {
			return;
		}
		this.alwaysSkipText = shouldAlwaysSkip;
		if (this.alwaysSkipText && this.currentAnimation && typeof this.currentAnimation.skip === "function") {
			this.currentAnimation.skip();
		}
		this.syncSkipButtonState();
		this.syncSkipToggleState();
	}

	syncSkipToggleState() {
		const toggle = this.elements.skipToggle;
		if (!toggle) return;
		const pressed = this.alwaysSkipText;
		toggle.setAttribute("aria-pressed", pressed ? "true" : "false");
		toggle.textContent = pressed ? "Auto Skip: On" : "Auto Skip: Off";
		toggle.setAttribute("aria-label", pressed ? "Disable always skip text" : "Enable always skip text");
	}

	setSkipButtonVisibility(isVisible) {
		const button = this.elements.skipButton;
		if (!button) return;
		const shouldShow = isVisible && !this.alwaysSkipText;
		if (shouldShow) {
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
		this.syncSkipButtonState();
		controller.start();
		if (this.alwaysSkipText && typeof controller.skip === "function") {
			controller.skip();
		}
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
		if (this.graphView) {
			this.graphView.update({
				story: this.story,
				state,
				currentBranchId: null,
			});
		}
	}
}
