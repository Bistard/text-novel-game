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
	document.title = `${branch.title} — ${DOCUMENT_SUFFIX}`;
}

export { DOCUMENT_SUFFIX };
