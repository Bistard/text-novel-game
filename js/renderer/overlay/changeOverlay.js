import { formatLabel, formatSigned } from "../../storyUtilities.js";
import { t } from "../../i18n/index.js";

/**
 * Displays stat and inventory changes as non-blocking toast notifications.
 */
export class ChangeOverlay {
	/**
	 * @param {{ prefersReducedMotion?: () => boolean }} [options]
	 */
	constructor(options = {}) {
		this.prefersReducedMotion =
			typeof options.prefersReducedMotion === "function" ? options.prefersReducedMotion : () => false;
		this.host = null;
		this.active = null;
	}

	/**
	 * Shows a transient summary of recent stat or inventory changes.
	 * @param {{ stats?: { stat: string, delta: number }[], inventory?: { item: string, delta: number }[], sourceLabel?: string|null }} [changes]
	 */
	show(changes = {}) {
		const stats = Array.isArray(changes.stats) ? changes.stats : [];
		const inventory = Array.isArray(changes.inventory) ? changes.inventory : [];
		const hasStats = stats.length > 0;
		const hasInventory = inventory.length > 0;
		if (!hasStats && !hasInventory) {
			return Promise.resolve();
		}

		const host = this.ensureHost();
		const reduceMotion = this.prefersReducedMotion();
		this.clearActiveToast();

		const toast = this.buildToast({
			stats,
			inventory,
			reduceMotion,
			sourceLabel:
				typeof changes.sourceLabel === "string" && changes.sourceLabel.trim() ? changes.sourceLabel.trim() : null,
		});

		host.appendChild(toast);

		// Force layout so the transition triggers reliably.
		void toast.offsetWidth;
		toast.classList.add("visible");

		return new Promise((resolve) => {
			let settled = false;
			const settle = () => {
				if (settled) {
					return;
				}
				settled = true;
				resolve();
			};

			const displayDuration = reduceMotion ? 2600 : 5200;
			const fadeDuration = reduceMotion ? 220 : 420;

			const removal = () => {
				if (toast.parentNode === host) {
					host.removeChild(toast);
				}
				if (this.active && this.active.toast === toast) {
					this.active = null;
				}
				settle();
			};

			const fadeTimer = globalThis.setTimeout(() => {
				toast.classList.remove("visible");
				toast.classList.add("leaving");
				const removeTimer = globalThis.setTimeout(removal, fadeDuration);
				if (this.active && this.active.toast === toast) {
					this.active.removeTimer = removeTimer;
				}
			}, displayDuration);

			this.active = {
				toast,
				fadeTimer,
				removeTimer: null,
				settle,
			};
		});
	}

	ensureHost() {
		if (this.host) {
			return this.host;
		}

		const host = document.createElement("div");
		host.className = "change-toast-host";
		host.setAttribute("aria-live", "polite");
		host.setAttribute("aria-atomic", "false");
		document.body.appendChild(host);

		this.host = host;
		return host;
	}

	clearActiveToast() {
		if (!this.active) {
			return;
		}

		const { toast, fadeTimer, removeTimer, settle } = this.active;
		if (typeof fadeTimer === "number") {
			globalThis.clearTimeout(fadeTimer);
		}
		if (typeof removeTimer === "number") {
			globalThis.clearTimeout(removeTimer);
		}
		if (toast && toast.parentNode) {
			toast.parentNode.removeChild(toast);
		}
		this.active = null;
		if (typeof settle === "function") {
			settle();
		}
	}

	buildToast({ stats, inventory, reduceMotion, sourceLabel }) {
		const toast = document.createElement("div");
		toast.className = "change-toast";

		const header = document.createElement("div");
		header.className = "change-toast-header";

		const title = document.createElement("span");
		title.className = "change-toast-title";
		const hasStats = stats.length > 0;
		const hasInventory = inventory.length > 0;
		const derivedTitle = hasStats && hasInventory
			? t("change.statusUpdated")
			: hasStats
				? t("change.statsUpdated")
				: t("change.inventoryUpdated");
		title.textContent = derivedTitle;
		header.appendChild(title);

		const subtitle = document.createElement("span");
		subtitle.className = "change-toast-source";
		if (sourceLabel) {
			subtitle.textContent = t("change.afterSource", { source: sourceLabel });
		} else {
			subtitle.textContent = t("change.recentChanges");
		}
		header.appendChild(subtitle);

		const body = document.createElement("div");
		body.className = "change-toast-body";

		let index = 0;
		if (hasStats) {
			body.appendChild(
				this.createSection({
					heading: t("change.statsSection"),
					entries: stats,
					type: "stat",
					reduceMotion,
					startIndex: index,
				})
			);
			index += stats.length;
		}

		if (hasInventory) {
			body.appendChild(
				this.createSection({
					heading: t("change.inventorySection"),
					entries: inventory,
					type: "inventory",
					reduceMotion,
					startIndex: index,
				})
			);
		}

		toast.appendChild(header);
		toast.appendChild(body);

		if (!reduceMotion) {
			toast.classList.add("animate");
		}

		return toast;
	}

	createSection({ heading, entries, type, reduceMotion, startIndex }) {
		const section = document.createElement("div");
		section.className = "change-toast-section";

		const title = document.createElement("div");
		title.className = "change-toast-section-title";
		title.textContent = heading;
		section.appendChild(title);

		const list = document.createElement("ul");
		list.className = "change-toast-list";
		list.setAttribute("role", "list");

		for (let i = 0; i < entries.length; i += 1) {
			const entry = entries[i];
			const item = this.createEntry({
				label: type === "stat" ? formatLabel(entry.stat) : formatLabel(entry.item),
				value: formatSigned(entry.delta),
				delta: entry.delta,
				type,
				delayIndex: startIndex + i,
				reduceMotion,
			});
			list.appendChild(item);
		}

		section.appendChild(list);
		return section;
	}

	createEntry({ label, value, delta, type, delayIndex, reduceMotion }) {
		const item = document.createElement("li");
		item.className = "change-toast-entry";
		item.dataset.type = type;

		const numericDelta = Number(delta) || 0;
		if (numericDelta > 0) {
			item.classList.add("gain");
		} else if (numericDelta < 0) {
			item.classList.add("loss");
		}

		const labelNode = document.createElement("span");
		labelNode.className = "change-toast-label";
		labelNode.textContent = label;

		const valueNode = document.createElement("span");
		valueNode.className = "change-toast-delta";
		valueNode.textContent = value;

		item.appendChild(labelNode);
		item.appendChild(valueNode);

		if (!reduceMotion) {
			const delay = Math.min(8, Math.max(0, Number(delayIndex) || 0));
			item.style.setProperty("--change-toast-delay", `${delay * 70}ms`);
		}

		return item;
	}
}
