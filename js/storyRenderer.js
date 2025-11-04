import { DiceOverlay } from "./diceOverlay.js";
import { chunkParagraphs, formatLabel, buildRollSummary } from "./storyUtilities.js";

const DOCUMENT_SUFFIX = "Narrative Demo";

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
	this.diceOverlay = new DiceOverlay({ prefersReducedMotion: this.prefersReducedMotion.bind(this) });
	this.handleSkipButtonClick = this.handleSkipButtonClick.bind(this);
	if (this.elements.skipButton) {
		this.elements.skipButton.addEventListener("click", this.handleSkipButtonClick);
	}
}

	/**
	 * @param {StoryBranch|null} branch
	 * @param {import("./storyState.js").StoryState} state
	 * @param {(choiceId: string) => void} onChoiceSelected
	 */
	render(branch, state, onChoiceSelected) {
		this.cancelCurrentAnimation();

		if (!branch) {
			this.renderEmptyState(state);
			return;
		}

		this.renderTitle(branch);
		this.clearChoices();
		this.renderStats(state);
		this.renderInventory(state);
		this.renderJournal(state);
		this.renderSystemMessages(state);

		this.renderStory(branch, () => {
			this.renderChoices(branch, onChoiceSelected);
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
	 * @param {StoryBranch} branch
	 */
	renderTitle(branch) {
		if (this.elements.nodeTitle) {
			this.elements.nodeTitle.textContent = branch.title;
		}
		if (this.elements.titleElement) {
			this.elements.titleElement.textContent = branch.title;
		}
		document.title = `${branch.title} — ${DOCUMENT_SUFFIX}`;
	}

	/**
	 * @param {StoryBranch} branch
	 * @param {() => void} onComplete
	 */
	renderStory(branch, onComplete) {
		const container = this.elements.storyText;
		if (!container) {
			this.setSkipButtonVisibility(false);
			if (typeof onComplete === "function") {
				onComplete();
			}
			return;
		}

		const paragraphs = chunkParagraphs(branch.description);
		const totalCharacters = paragraphs.reduce((sum, text) => sum + text.length, 0);
		const reduceMotion = this.prefersReducedMotion();

		container.innerHTML = "";
		container.scrollTop = 0;

		if (!paragraphs.length || totalCharacters === 0) {
			container.textContent = branch.description;
			this.setSkipButtonVisibility(false);
			if (typeof onComplete === "function") {
				onComplete();
			}
			return;
		}

		if (reduceMotion) {
			for (const text of paragraphs) {
				const p = document.createElement("p");
				p.className = "story-paragraph paragraph-enter paragraph-enter-active";
				p.textContent = text;
				container.appendChild(p);
			}
			this.setSkipButtonVisibility(false);
			if (typeof onComplete === "function") {
				onComplete();
			}
			return;
		}

		const controller = this.createAnimationController(container, paragraphs, onComplete);
		this.currentAnimation = controller;
		this.setSkipButtonVisibility(true);
		controller.start();
	}

	/**
	 * @param {HTMLElement} container
	 * @param {string[]} paragraphs
	 * @param {() => void} [onComplete]
	 */
	createAnimationController(container, paragraphs, onComplete) {
		const hasRAF = typeof globalThis.requestAnimationFrame === "function";
		const scheduleFrame = hasRAF
			? (callback) => globalThis.requestAnimationFrame(callback)
			: (callback) => globalThis.setTimeout(callback, 16);
		const cancelFrame = hasRAF
			? (id) => globalThis.cancelAnimationFrame(id)
			: (id) => globalThis.clearTimeout(id);

		const controller = {
			cancelled: false,
			skipRequested: false,
			timeouts: new Set(),
			rafIds: new Set(),
			pendingResolvers: new Set(),
			cancel: () => {
				if (controller.cancelled) return;
				controller.cancelled = true;
				controller.clearTimers();
				controller.flushAnimationFrames();
				controller.flushPendingResolvers();
			},
			skip: () => {
				if (controller.cancelled || controller.skipRequested) return;
				controller.skipRequested = true;
				controller.flushPendingResolvers();
				controller.clearTimers();
				controller.flushAnimationFrames();
				controller.revealAll();
			},
			clearTimers: () => {
				for (const id of controller.timeouts) {
					globalThis.clearTimeout(id);
				}
				controller.timeouts.clear();
			},
			flushAnimationFrames: () => {
				for (const id of controller.rafIds) {
					cancelFrame(id);
				}
				controller.rafIds.clear();
			},
			revealAll: () => {
				for (const node of container.children) {
					if (node instanceof HTMLElement && node.dataset && typeof node.dataset.fullText === "string") {
						node.textContent = node.dataset.fullText;
						node.classList.add("paragraph-enter-active");
					}
				}
			},
			flushPendingResolvers: () => {
				if (!controller.pendingResolvers.size) return;
				const resolvers = Array.from(controller.pendingResolvers);
				controller.pendingResolvers.clear();
				for (const finish of resolvers) {
					finish();
				}
			},
			delay: (duration) =>
				new Promise((resolve) => {
					if (duration <= 0 || controller.cancelled || controller.skipRequested) {
						resolve();
						return;
					}
					const timerId = globalThis.setTimeout(() => {
						controller.timeouts.delete(timerId);
						resolve();
					}, duration);
					controller.timeouts.add(timerId);
				}),
			typeParagraph: (element, fullText) =>
				new Promise((resolve) => {
					if (!fullText || !fullText.length) {
						element.textContent = fullText;
						resolve();
						return;
					}

					let position = 0;
					let done = false;
					const finish = () => {
						if (done) return;
						done = true;
						controller.pendingResolvers.delete(finish);
						element.textContent = fullText;
						resolve();
					};
					controller.pendingResolvers.add(finish);

					const step = () => {
						if (controller.cancelled) {
							finish();
							return;
						}
						if (controller.skipRequested) {
							finish();
							return;
						}

						position += 1;
						element.textContent = fullText.slice(0, position);

						if (position >= fullText.length) {
							finish();
							return;
						}

						const delay = this.getCharacterDelay(fullText.charAt(position - 1));
						const timerId = globalThis.setTimeout(() => {
							controller.timeouts.delete(timerId);
							step();
						}, delay);
						controller.timeouts.add(timerId);
					};

					step();
				}),
			start: async () => {
				try {
					for (let index = 0; index < paragraphs.length; index += 1) {
						if (controller.cancelled) {
							return;
						}
						const text = paragraphs[index];
						const paragraph = document.createElement("p");
						paragraph.className = "story-paragraph paragraph-enter";
						paragraph.dataset.fullText = text;
						container.appendChild(paragraph);

						if (controller.skipRequested) {
							paragraph.textContent = text;
							paragraph.classList.add("paragraph-enter-active");
						} else {
							const rafId = scheduleFrame(() => {
								controller.rafIds.delete(rafId);
								paragraph.classList.add("paragraph-enter-active");
							});
							controller.rafIds.add(rafId);

							await controller.typeParagraph(paragraph, text);
							if (controller.cancelled) {
								return;
							}
							if (!controller.skipRequested && index < paragraphs.length - 1) {
								await controller.delay(this.getParagraphPause(text));
							}
						}
					}
				} finally {
					if (this.currentAnimation === controller) {
						this.currentAnimation = null;
					}
					controller.clearTimers();
					controller.flushAnimationFrames();
					this.setSkipButtonVisibility(false);
					if (!controller.cancelled && typeof onComplete === "function") {
						onComplete();
					}
				}
			},
		};

		return controller;
	}

	/**
	 * Displays the dice roll overlay, plays the animation, and waits for user confirmation.
	 * @param {import("./storyUtilities.js").RollResult} result
	 * @param {{ duration?: number, statEffects?: { stat: string, delta: number }[] }} [options]
	 */
	async showRollResult(result, options = {}) {
		this.cancelCurrentAnimation();
		this.setSkipButtonVisibility(false);
		if (!result || !this.diceOverlay) return;
		await this.diceOverlay.show(result, options);
	}

	prefersReducedMotion() {
		const media = typeof globalThis.matchMedia === "function" ? globalThis.matchMedia("(prefers-reduced-motion: reduce)") : null;
		return Boolean(media && media.matches);
	}

	getCharacterDelay(char) {
		const base = 28;
		const slowChars = new Map([
			[",", 110],
			[".", 180],
			["!", 180],
			["?", 180],
			[";", 140],
			[":", 140],
			["—", 160],
			["…", 220],
			["，", 120],
			["。", 200],
			["！", 200],
			["？", 200],
			["；", 150],
			["：", 150],
		]);

		if (!char) {
			return base;
		}
		if (/\s/.test(char)) {
			return 18;
		}
		return slowChars.get(char) || base;
	}

	getParagraphPause(text) {
		if (!text) {
			return 0;
		}
		const trimmed = text.trim();
		if (!trimmed) {
			return 0;
		}
		const lastChar = trimmed.charAt(trimmed.length - 1);
		if ("?!。！？".includes(lastChar)) {
			return 260;
		}
		if (",;，；、".includes(lastChar)) {
			return 180;
		}
		return 140;
	}

	/**
	 * @param {StoryBranch} branch
	 * @param {(choiceId: string) => void} onChoiceSelected
	 */
	renderChoices(branch, onChoiceSelected) {
		const container = this.elements.choices;
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

		for (const choice of branch.choices) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "choice-button";
			button.dataset.choiceId = choice.id;
			button.textContent = choice.text;
			button.addEventListener("click", () => handler(choice.id));
			container.appendChild(button);
		}
	}

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderStats(state) {
		const container = this.elements.stats;
		if (!container) return;
		container.innerHTML = "";

		const entries = Object.entries(state.stats).filter(([, value]) => value !== 0);
		if (!entries.length) {
			const placeholder = document.createElement("div");
			placeholder.className = "muted";
			placeholder.textContent = "No stats yet.";
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

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderInventory(state) {
		const list = this.elements.inventory;
		if (!list) return;
		list.innerHTML = "";

		const entries = Object.entries(state.inventory).filter(([, count]) => count > 0);
		if (!entries.length) {
			const placeholder = document.createElement("li");
			placeholder.textContent = "Inventory empty.";
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

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderJournal(state) {
		const list = this.elements.journal;
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

	/**
	 * @param {import("./storyState.js").StoryState} state
	 */
	renderSystemMessages(state) {
		const container = this.elements.systemMessages;
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

	/**
	 * @param {import("./storyState.js").StoryState} state
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

		this.renderStats(state);
		this.renderInventory(state);
		this.renderJournal(state);
		this.renderSystemMessages(state);
		document.title = `Story unavailable — ${DOCUMENT_SUFFIX}`;
	}
}

/**
 * @typedef {Object} StoryBranch
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {StoryChoice[]} choices
 */

/**
 * @typedef {Object} StoryChoice
 * @property {string} id
 * @property {string} text
 * @property {string|null} next
 * @property {{ stat: string, delta: number }[]} stats
 * @property {{ item: string, delta: number }[]} inventory
 * @property {import("./storyUtilities.js").RollDirective|null} roll
 */
