import { t } from "../../i18n/index.js";

const DOCUMENT_SUFFIX = "Narrative Demo";

/**
 * Updates the title elements for the active branch.
 * @param {{ nodeTitle?: HTMLElement|null, titleElement?: HTMLElement|null }} elements
 * @param {import("../../parser/types.js").StoryBranch} branch
 */
export function renderTitle(elements, branch) {
	if (elements.nodeTitle) {
		elements.nodeTitle.textContent = branch.title;
	}
	if (elements.titleElement) {
		elements.titleElement.textContent = branch.title;
	}
	const suffix = t("app.documentTitleSuffix") || DOCUMENT_SUFFIX;
	document.title = `${branch.title} - ${suffix}`;
}

export { DOCUMENT_SUFFIX };
