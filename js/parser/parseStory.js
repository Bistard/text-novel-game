import {
	createParseContext,
	createBranchContext,
	finalizeBranch,
	extractDirectiveValue,
	normalizeBranchId,
} from "./branchContext.js";
import { parseChoice } from "./choiceParser.js";

const COMMENT_PREFIX = "#";

/**
 * Parses the custom branch-based story format into structured data.
 * Each branch must start with a Title line, followed by its Branch number,
 * description, and one or more Choice lines.
 *
 * @param {string} raw
 * @returns {{ start: string, branches: Record<string, import("./types.js").StoryBranch> }}
 */
export function parseStory(raw) {
	if (typeof raw !== "string") {
		throw new TypeError("Story parser expected a string payload.");
	}

	const lines = raw.split(/\r?\n/);
	const context = createParseContext();

	for (let index = 0; index <= lines.length; index += 1) {
		const rawLine = index < lines.length ? lines[index] : null;

		if (rawLine === null) {
			finalizeBranch(context);
			break;
		}

		const trimmed = rawLine.trim();

		// Preserve blank lines inside the description block.
		if (!trimmed) {
			if (context.current && context.descriptionActive) {
				context.current.descriptionLines.push("");
			}
			continue;
		}

		if (trimmed.startsWith(COMMENT_PREFIX)) {
			continue;
		}

		const lower = trimmed.toLowerCase();

		if (lower.startsWith("title:")) {
			finalizeBranch(context);
			context.current = createBranchContext(extractDirectiveValue(rawLine, "Title", index));
			context.descriptionActive = false;
			continue;
		}

		if (!context.current) {
			throw new Error(
				`Unexpected content before the first branch on line ${index + 1}. Start branches with "Title:".`
			);
		}

		if (lower.startsWith("branch:")) {
			context.current.id = normalizeBranchId(extractDirectiveValue(rawLine, "Branch", index));
			context.descriptionActive = false;
			continue;
		}

		if (lower.startsWith("description:")) {
			const firstLine = extractDirectiveValue(rawLine, "Description", index);
			context.current.descriptionLines = [firstLine];
			context.descriptionActive = true;
			continue;
		}

		if (lower.startsWith("choice:")) {
			const delimiter = rawLine.indexOf(":");
			const payload = rawLine.slice(delimiter + 1).trim();
			if (!payload) {
				throw new Error(`Choice definition on line ${index + 1} is missing content.`);
			}
			context.current.choices.push(parseChoice(context.current.id || "", payload, index + 1));
			context.descriptionActive = false;
			continue;
		}

		if (context.descriptionActive) {
			context.current.descriptionLines.push(rawLine.trim());
			continue;
		}

		throw new Error(`Unrecognised directive on line ${index + 1}: "${rawLine}".`);
	}

	if (!context.branches.length) {
		throw new Error("No branches were discovered in the story file.");
	}

	const branchMap = {};
	let startId = null;

	for (const branchContext of context.branches) {
		if (branchMap[branchContext.id]) {
			throw new Error(`Duplicate branch id "${branchContext.id}" encountered.`);
		}

		const description = branchContext.descriptionLines.join("\n").trim();
		if (!description) {
			throw new Error(`Branch "${branchContext.id}" is missing a description.`);
		}

		const branch = {
			id: branchContext.id,
			title: branchContext.title,
			description,
			choices: branchContext.choices.map((choice, idx) => ({
				id: `${branchContext.id}:${idx + 1}`,
				text: choice.text,
				next: choice.next,
				stats: choice.stats,
				inventory: choice.inventory,
				roll: choice.roll,
				visibilityCondition: choice.visibilityCondition,
				validCondition: choice.validCondition,
			})),
		};

		branchMap[branch.id] = branch;
		if (!startId) {
			startId = branch.id;
		}
	}

	return { start: startId, branches: branchMap };
}
