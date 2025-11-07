import { formatLabel, formatSigned } from "../../storyUtilities.js";
import { t } from "../../i18n/index.js";

/**
 * Presents stat and inventory changes in an overlay similar to the dice roll UI.
 */
export class ChangeOverlay {
	/**
	 * @param {{ prefersReducedMotion?: () => boolean }} [options]
	 */
	constructor(options = {}) {
		this.prefersReducedMotion =
			typeof options.prefersReducedMotion === "function" ? options.prefersReducedMotion : () => false;
		this.overlayElements = null;
	}

	/**
	 * Displays the change overlay and waits for acknowledgement.
	 * @param {{ stats?: { stat: string, delta: number }[], inventory?: { item: string, delta: number }[], sourceLabel?: string|null }} [changes]
	 */
	async show(changes = {}) {
		const stats = Array.isArray(changes.stats) ? changes.stats : [];
		const inventory = Array.isArray(changes.inventory) ? changes.inventory : [];
		const hasStats = stats.length > 0;
		const hasInventory = inventory.length > 0;
		if (!hasStats && !hasInventory) {
			return;
		}

		const overlay = this.ensureOverlay();
		const { root, title, subtitle, list, continueButton } = overlay;
		const reduceMotion = this.prefersReducedMotion();
		continueButton.textContent = t("common.continue");

		root.hidden = false;
		root.classList.add("visible");

		const derivedTitle = hasStats && hasInventory
			? t("change.statusUpdated")
			: hasStats
				? t("change.statsUpdated")
				: t("change.inventoryUpdated");
		title.textContent = derivedTitle;

		const source = typeof changes.sourceLabel === "string" && changes.sourceLabel.trim() ? changes.sourceLabel.trim() : "";
		subtitle.textContent = source ? t("change.afterSource", { source }) : t("change.recentChanges");

		list.innerHTML = "";

		let index = 0;
		if (hasStats) {
			list.appendChild(this.createSectionHeading(t("change.statsSection")));
			for (const effect of stats) {
				const entry = this.createChangeEntry({
					label: formatLabel(effect.stat),
					value: formatSigned(effect.delta),
					delta: effect.delta,
					type: "stat",
					delayIndex: index++,
					reduceMotion,
				});
				list.appendChild(entry);
			}
		}

		if (hasInventory) {
			list.appendChild(this.createSectionHeading(t("change.inventorySection")));
			for (const effect of inventory) {
				const entry = this.createChangeEntry({
					label: formatLabel(effect.item),
					value: formatSigned(effect.delta),
					delta: effect.delta,
					type: "inventory",
					delayIndex: index++,
					reduceMotion,
				});
				list.appendChild(entry);
			}
		}

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

	ensureOverlay() {
		if (this.overlayElements) {
			return this.overlayElements;
		}

		const root = document.createElement("div");
		root.className = "roll-overlay change-overlay";
		root.hidden = true;

		const dialog = document.createElement("div");
		dialog.className = "roll-overlay-dialog";
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");

		const header = document.createElement("div");
		header.className = "change-overlay-header";

		const title = document.createElement("h2");
		title.className = "change-overlay-title";
		header.appendChild(title);

		const subtitle = document.createElement("p");
		subtitle.className = "change-overlay-subtitle";
		header.appendChild(subtitle);

		const list = document.createElement("div");
		list.className = "change-overlay-list";
		list.setAttribute("role", "list");

		const continueButton = document.createElement("button");
		continueButton.type = "button";
		continueButton.className = "button roll-overlay-continue change-overlay-continue";
		continueButton.textContent = t("common.continue");

		dialog.appendChild(header);
		dialog.appendChild(list);
		dialog.appendChild(continueButton);
		root.appendChild(dialog);
		document.body.appendChild(root);

		this.overlayElements = { root, dialog, header, title, subtitle, list, continueButton };
		return this.overlayElements;
	}

	createSectionHeading(text) {
		const heading = document.createElement("p");
		heading.className = "change-overlay-section";
		heading.textContent = text;
		return heading;
	}

	createChangeEntry({ label, value, delta, type, delayIndex, reduceMotion }) {
		const entry = document.createElement("div");
		entry.className = "change-overlay-entry";
		entry.dataset.type = type;
		const numericDelta = Number(delta) || 0;
		if (numericDelta > 0) {
			entry.classList.add("gain");
		} else if (numericDelta < 0) {
			entry.classList.add("loss");
		}

		const labelNode = document.createElement("span");
		labelNode.className = "change-overlay-label";
		labelNode.textContent = label;

		const valueNode = document.createElement("span");
		valueNode.className = "change-overlay-delta";
		valueNode.textContent = value;

		entry.appendChild(labelNode);
		entry.appendChild(valueNode);

		if (!reduceMotion) {
			entry.classList.add("animate");
			const delay = Math.min(8, Math.max(0, Number(delayIndex) || 0));
			entry.style.setProperty("--change-overlay-delay", `${delay * 80}ms`);
		}

		return entry;
	}
}
