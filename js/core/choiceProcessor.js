/**
 * Applies the effects of a selected choice to the story state.
 * @param {{ choice: import("../parser/types.js").StoryChoice, state: import("../state/storyState.js").StoryState, renderer: import("../renderer/storyRenderer.js").StoryRenderer, runRollImpl: typeof import("../rollSystem.js").runRoll, formatSigned: (value: number) => string }} payload
 * @returns {Promise<{ nextBranchId: string|null }>}
 */
export async function processChoiceSelection({ choice, state, renderer, runRollImpl, formatSigned }) {
	const summaries = [];
	let rollOutcomeLabel = null;
	let nextBranchId = choice.next || null;

	const unknownStatNames = new Set();
	const statEvaluationIssues = [];
	const evaluateStatEffects = (effects, context = {}) => {
		const partition = state.partitionStatEffects(effects || []);
		for (const name of partition.unknown) {
			if (name) {
				unknownStatNames.add(name);
			}
		}
		const evaluation = state.evaluateStatEffects(partition.allowed, context);
		if (evaluation.issues.length) {
			statEvaluationIssues.push(...evaluation.issues);
		}
		return evaluation.evaluated;
	};

	let evaluatedStatEffects = [];
	let inventoryEffectsToApply = [];
	let appliedStats = [];
	let appliedInventoryEffects = [];

	if (choice.roll) {
		const rollResult = runRollImpl(choice.roll, (stat) => state.getStatValue(stat));
		evaluatedStatEffects = evaluateStatEffects(choice.stats, { rollResult });
		if (rollResult.success) {
			inventoryEffectsToApply = Array.isArray(choice.inventory) ? choice.inventory.slice() : [];
			rollOutcomeLabel = "Roll: Success";
		} else {
			inventoryEffectsToApply = [];
			rollOutcomeLabel = "Roll: Failure";
		}
		try {
			await renderer.showRollResult(rollResult, {
				statEffects: evaluatedStatEffects,
			});
		} catch (error) {
			console.error("Dice animation failed:", error);
		}
		state.clearLastRoll();
		nextBranchId = rollResult.success ? choice.roll.ok : choice.roll.fail;
	} else {
		evaluatedStatEffects = evaluateStatEffects(choice.stats);
		inventoryEffectsToApply = Array.isArray(choice.inventory) ? choice.inventory.slice() : [];
	}

	if (rollOutcomeLabel) {
		summaries.push(rollOutcomeLabel);
	}

	if (evaluatedStatEffects.length) {
		appliedStats = state.applyEvaluatedStatEffects(evaluatedStatEffects);
		if (appliedStats.length) {
			const labels = appliedStats.map((effect) => `${effect.stat} ${formatSigned(effect.delta)}`);
			summaries.push(`Stats: ${labels.join(", ")}`);
		}
	}

	if (inventoryEffectsToApply.length) {
		appliedInventoryEffects = state.applyInventoryEffects(inventoryEffectsToApply);
		if (appliedInventoryEffects.length) {
			const labels = appliedInventoryEffects.map((effect) => `${effect.item} ${formatSigned(effect.delta)}`);
			summaries.push(`Inventory: ${labels.join(", ")}`);
		}
	}

	if (appliedStats.length || appliedInventoryEffects.length) {
		const journalEntry = summaries.length ? `${choice.text} → ${summaries.join(" | ")}` : `${choice.text}`;
		state.appendJournal(journalEntry);
		if (renderer && typeof renderer.showChangeSummary === "function") {
			try {
				renderer.showChangeSummary({
					stats: appliedStats,
					inventory: appliedInventoryEffects,
					sourceLabel: choice.text,
				});
			} catch (error) {
				console.error("Change notification failed:", error);
			}
		}
	}

	if (!state.systemError) {
		if (unknownStatNames.size) {
			const names = Array.from(unknownStatNames).sort((a, b) => a.localeCompare(b));
			console.warn("Unknown stat(s) encountered:", names);
			const suffix = names.length > 1 ? "s" : "";
			state.setSystemError(`Unknown stat${suffix} encountered: ${names.join(", ")}. Update the stat config.`);
		} else if (statEvaluationIssues.length) {
			const message = statEvaluationIssues.join(" | ");
			console.warn("Dynamic stat resolution issues:", message);
			state.setSystemError(message);
		}
	}

	return { nextBranchId };
}
