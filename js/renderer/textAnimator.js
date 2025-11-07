/**
 * Handles progressive paragraph reveal animations for story content.
 */
export class TextAnimator {
	/**
	 * @param {{ prefersReducedMotion?: () => boolean, getCharacterDelay?: (char: string) => number, getParagraphPause?: (text: string) => number }} [options]
	 */
	constructor(options = {}) {
		this.prefersReducedMotion =
			typeof options.prefersReducedMotion === "function" ? options.prefersReducedMotion : () => false;
		this.characterDelay =
			typeof options.getCharacterDelay === "function" ? options.getCharacterDelay : defaultCharacterDelay;
		this.paragraphPause =
			typeof options.getParagraphPause === "function" ? options.getParagraphPause : defaultParagraphPause;
	}

	/**
	 * Renders the story text into the container, optionally animating paragraph reveal.
	 * @param {{ container: HTMLElement|null, description: string, paragraphs: string[] }} payload
	 * @param {{ onAfterFinish?: (result: { cancelled: boolean }) => void }} [hooks]
	 * @returns {{ controller: AnimationController|null, hasAnimation: boolean }}
	 */
	animate({ container, description, paragraphs }, hooks = {}) {
		const onAfterFinish = typeof hooks.onAfterFinish === "function" ? hooks.onAfterFinish : null;

		if (!container) {
			if (onAfterFinish) {
				onAfterFinish({ cancelled: false });
			}
			return { controller: null, hasAnimation: false };
		}

		const safeParagraphs = Array.isArray(paragraphs) ? paragraphs : [];
		const totalCharacters = safeParagraphs.reduce((sum, text) => sum + text.length, 0);

		container.innerHTML = "";
		container.scrollTop = 0;

		if (!safeParagraphs.length || totalCharacters === 0) {
			container.textContent = description || "";
			if (onAfterFinish) {
				onAfterFinish({ cancelled: false });
			}
			return { controller: null, hasAnimation: false };
		}

		if (this.prefersReducedMotion()) {
			for (const text of safeParagraphs) {
				const p = document.createElement("p");
				p.className = "story-paragraph paragraph-enter paragraph-enter-active";
				p.textContent = text;
				container.appendChild(p);
			}
			if (onAfterFinish) {
				onAfterFinish({ cancelled: false });
			}
			return { controller: null, hasAnimation: false };
		}

		const controller = this.createAnimationController(container, safeParagraphs, onAfterFinish);
		return { controller, hasAnimation: true };
	}

	createAnimationController(container, paragraphs, onAfterFinish) {
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
				if (onAfterFinish) {
					onAfterFinish({ cancelled: true });
				}
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
						if (controller.cancelled || controller.skipRequested) {
							finish();
							return;
						}

						position += 1;
						element.textContent = fullText.slice(0, position);

						if (position >= fullText.length) {
							finish();
							return;
						}

						const delay = this.characterDelay(fullText.charAt(position - 1));
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
								await controller.delay(this.paragraphPause(text));
							}
						}
					}
				} finally {
					controller.clearTimers();
					controller.flushAnimationFrames();
					if (onAfterFinish) {
						onAfterFinish({ cancelled: controller.cancelled });
					}
				}
			},
		};

		return controller;
	}
}

function defaultCharacterDelay(char) {
	const base = 22;
	const slowChars = new Map([
		[",", 90],
		[".", 150],
		["!", 150],
		["?", 150],
		[";", 120],
		[":", 120],
		["\u2014", 140],
		["\u2026", 180],
		["\uFF0C", 100],
		["\u3002", 170],
		["\uFF01", 170],
		["\uFF1F", 170],
		["\uFF1B", 120],
		["\uFF1A", 120],
	]);

	if (!char) {
		return base;
	}
	if (/\s/.test(char)) {
		return 14;
	}
	return slowChars.get(char) || base;
}

function defaultParagraphPause(text) {
	if (!text) {
		return 0;
	}
	const trimmed = text.trim();
	if (!trimmed) {
		return 0;
	}
	const lastChar = trimmed.charAt(trimmed.length - 1);
	if ("?!\u3002\uFF01\uFF1F".includes(lastChar)) {
		return 220;
	}
	if (",;\uFF0C\uFF1B\u3001".includes(lastChar)) {
		return 150;
	}
	return 120;
}

/**
 * @typedef {Object} AnimationController
 * @property {boolean} cancelled
 * @property {boolean} skipRequested
 * @property {() => void} cancel
 * @property {() => void} skip
 * @property {() => Promise<void>} start
 */
