import { formatLabel, formatSigned } from "../../storyUtilities.js";
import { t } from "../../i18n/index.js";

/**
 * Handles presentation of dice roll overlays and animations.
 */
export class DiceOverlay {
	/**
	 * @param {{ prefersReducedMotion?: () => boolean }} [options]
	 */
	constructor(options = {}) {
		this.prefersReducedMotion = typeof options.prefersReducedMotion === "function" ? options.prefersReducedMotion : () => false;
		this.rollOverlayElements = null;
	}

	/**
	 * Shows the dice roll overlay, animates the die, and waits for acknowledgement.
	 * @param {import("../../storyUtilities.js").RollResult} result
	 * @param {{ duration?: number, statEffects?: { stat: string, delta: number }[] }} [options]
	 */
	async show(result, options = {}) {
		if (!result) return;
		const overlay = this.ensureRollOverlay();
		const { root, die, status, detail, continueButton } = overlay;
		continueButton.textContent = t("common.continue");

		root.hidden = false;
		root.classList.add("visible");

		status.textContent = "";
		status.className = "roll-overlay-status";
		detail.textContent = "";
		detail.className = "roll-overlay-detail";
		continueButton.hidden = true;
		continueButton.disabled = true;

		die.className = "die face-1";

		await this.animateDie(die, result, options);

		const isSuccess = Boolean(result.success);
		status.textContent = isSuccess ? t("common.success") : t("common.failure");
		status.className = `roll-overlay-status ${isSuccess ? "success" : "failure"}`;

		this.populateRollDetail(detail, result, isSuccess, options);

		continueButton.hidden = false;
		continueButton.disabled = false;
		try {
			continueButton.focus({ preventScroll: true });
		} catch {
			continueButton.focus();
		}

		await new Promise((resolve) => {
			const handle = () => {
				continueButton.removeEventListener("click", handle);
				root.classList.remove("visible");
				root.hidden = true;
				resolve();
			};
			continueButton.addEventListener("click", handle, { once: true });
		});
	}

	/**
	 * Animates the die to simulate rolling.
	 * @param {HTMLElement} die
	 * @param {import("../../storyUtilities.js").RollResult} result
	 * @param {{ duration?: number }} [options]
	 */
	async animateDie(die, result, options = {}) {
		if (!(die instanceof HTMLElement)) return;
		const duration = Math.max(800, options.duration || 1500);
		const reduceMotion = this.prefersReducedMotion();
		const endFace = this.normalizeDieFace(result);

		if (reduceMotion) {
			die.className = `die face-${endFace}`;
			await this.sleep(260);
			return;
		}

		const faces = [1, 2, 3, 4, 5, 6];
		let elapsed = 0;
		const jitter = 110;

		die.className = "die face-1 shake";

		while (elapsed < duration - 220) {
			const randomFace = faces[Math.floor(Math.random() * faces.length)];
			die.className = `die face-${randomFace} shake`;
			await this.sleep(jitter);
			elapsed += jitter;
		}

		die.className = `die face-${endFace}`;
		await this.sleep(360);
	}

	/**
	 * Normalises the value to the nearest die face.
	 * @param {import("../../storyUtilities.js").RollResult} result
	 */
	normalizeDieFace(result) {
		const sides = result?.directive?.dice?.sides || 6;
		const fallback = result?.total || 1;
		const lastRoll =
			Array.isArray(result?.rolls) && result.rolls.length ? result.rolls[result.rolls.length - 1] : result?.diceTotal ?? fallback;
		const rounded = Number.isFinite(lastRoll) ? Math.round(lastRoll) : 1;
		if (sides === 6) {
			return Math.min(6, Math.max(1, rounded));
		}
		const offset = ((rounded - 1) % 6 + 6) % 6;
		return Math.min(6, Math.max(1, offset + 1));
	}

	/**
	 * Ensures the overlay DOM nodes exist.
	 */
	ensureRollOverlay() {
		if (this.rollOverlayElements) {
			return this.rollOverlayElements;
		}

		const root = document.createElement("div");
		root.className = "roll-overlay";
		root.hidden = true;

		const dialog = document.createElement("div");
		dialog.className = "roll-overlay-dialog";
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");

		const dieWrapper = document.createElement("div");
		dieWrapper.className = "roll-overlay-die";
		const die = this.createDieElement();
		dieWrapper.appendChild(die);

		const status = document.createElement("p");
		status.className = "roll-overlay-status";
		const statusId = "roll-overlay-status";
		status.id = statusId;
		dialog.setAttribute("aria-labelledby", statusId);

		const detail = document.createElement("div");
		detail.className = "roll-overlay-detail";
		const detailId = "roll-overlay-detail";
		detail.id = detailId;
		dialog.setAttribute("aria-describedby", detailId);

		const continueButton = document.createElement("button");
		continueButton.type = "button";
		continueButton.className = "button roll-overlay-continue";
		continueButton.textContent = t("common.continue");

		dialog.appendChild(dieWrapper);
		dialog.appendChild(status);
		dialog.appendChild(detail);
		dialog.appendChild(continueButton);
		root.appendChild(dialog);
		document.body.appendChild(root);

		this.rollOverlayElements = { root, dialog, die, status, detail, continueButton };
		return this.rollOverlayElements;
	}

	createDieElement() {
		const die = document.createElement("div");
		die.className = "die face-1";
		const pipClasses = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
		for (const pipClass of pipClasses) {
			const pip = document.createElement("span");
			pip.className = `pip ${pipClass}`;
			die.appendChild(pip);
		}
		return die;
	}

	/**
	 * Populates the overlay with detailed roll information.
	 * @param {HTMLElement} container
	 * @param {import("../../storyUtilities.js").RollResult} result
	 * @param {boolean} isSuccess
	 * @param {{ statEffects?: { stat: string, delta: number }[] }} [options]
	 */
	populateRollDetail(container, result, isSuccess, options = {}) {
		if (!(container instanceof HTMLElement) || !result) return;
		container.className = "roll-overlay-detail";
		container.classList.add(isSuccess ? "success" : "failure");
		container.innerHTML = "";

		const rows = [];
		const directiveStat = typeof result?.directive?.stat === "string" ? result.directive.stat : "";
		if (directiveStat) {
			const label = formatLabel(directiveStat);
			const baseModifier = result.statValue ?? 0;
			let modifierTotal = baseModifier;
			const statKey = directiveStat.toLowerCase();
			const statEffects = Array.isArray(options.statEffects) ? options.statEffects : [];
			if (statEffects.length) {
				const delta = statEffects
					.filter((effect) => typeof effect?.stat === "string" && effect.stat.toLowerCase() === statKey)
					.reduce((sum, effect) => sum + (Number(effect.delta) || 0), 0);
				if (delta) {
					modifierTotal += delta;
				}
			}
			const modifier = formatSigned(modifierTotal);
			if (label) {
				rows.push({ label: t("roll.modifierLine"), value: `${label} ${modifier}` });
			}
		}
		if (Array.isArray(result?.rolls) && result.rolls.length) {
			const dice = result.directive?.dice || { count: 1, sides: 6 };
			const diceLabel = dice.count === 1 ? `d${dice.sides}` : `${dice.count}d${dice.sides}`;
			rows.push({
				label: t("roll.diceLine"),
				value: `${diceLabel} -> ${result.rolls.join(" + ")}`,
			});
		}
		rows.push({ label: t("roll.totalLine"), value: String(result.total) });
		if (result?.directive?.target != null) {
			rows.push({ label: t("roll.targetLine"), value: String(result.directive.target) });
		}

		for (const row of rows) {
			const line = document.createElement("div");
			line.className = "roll-detail-row";
			const label = document.createElement("span");
			label.className = "roll-detail-label";
			label.textContent = row.label;
			const value = document.createElement("span");
			value.className = "roll-detail-value";
			value.textContent = row.value;
			line.append(label, value);
			container.appendChild(line);
		}

		if (!rows.length) {
			const fallback = document.createElement("div");
			fallback.className = "roll-detail-row";
			const value = document.createElement("span");
			value.className = "roll-detail-value";
			value.textContent = t("roll.noDetails");
			fallback.appendChild(value);
			container.appendChild(fallback);
		}
	}

	sleep(ms) {
		return new Promise((resolve) => {
			globalThis.setTimeout(resolve, ms);
		});
	}
}
