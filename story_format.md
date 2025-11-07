# Story File Format

The narrative script in `assets/story.txt` is a plain–text format parsed by `js/storyParser.js`. Each branch describes a single story node, its body text, and interactive choices. This document explains every directive the parser understands, including the new condition system.

> **Encoding & spacing**  
> Save files as UTF‑8 without BOM. Lines may end with either LF or CRLF. Whitespace around directive values is trimmed.

## File Structure

- Branches are written one after another. The first valid branch becomes the story’s starting node.
- Each branch must include, in order:
  1. `Title:` — player-facing heading.
  2. `Branch:` — unique identifier used for jumps and references.
  3. `Description:` — one or more lines of prose.
  4. One or more `Choice:` lines.
- Blank lines are allowed between directives and are ignored inside descriptions.
- Any line that starts with `#` is treated as a comment and skipped.

### Example Branch

```
Title: Home_Planet_09
Branch: A9
Description: The nostalgic sensation empowers you, a second wind during this struggle.
Choice: display=[Roll 2d6]; roll=luck, dice=2d6, target=10, ok=A11, fail=A10; stat=luck+roll
```

## Branch Directives

| Directive | Required | Purpose |
|-----------|----------|---------|
| `Title:` | Yes | Human-readable branch name shown in the UI and window title. |
| `Branch:` | Yes | Unique branch ID used in `next`, `ok`, and `fail` references. Value is trimmed verbatim; maintain consistent casing. |
| `Description:` | Yes | Begins the narrative body. Everything after the colon on the same line is the first paragraph. Subsequent non-empty lines (until another directive or comment) are appended as additional paragraphs, with blank lines preserved as paragraph breaks. |
| `Choice:` | Yes (≥1) | Adds an interactive option. The remainder of the line is parsed into directives separated by semicolons. |

### Description Notes

- Wrap text as needed. Internal blank lines insert empty paragraphs.
- Markdown is not parsed; all content is shown as plain text.

## Choice Directive Reference

A `Choice:` line is split on `;`. Each segment must follow `key=value`. Values may be wrapped in square brackets `[like this]` for clarity. Unsupported keys produce a parse error.

| Key | Required | Details |
|-----|----------|---------|
| `display` | Yes | Button label. Use `[ ]` if the text contains semicolons. |
| `next` | Required unless `roll` is present | Destination branch ID. Trimmed exactly; must match a `Branch:` somewhere in the file. |
| `stat` | No (repeatable) | Applies a stat change when the choice resolves. See [Stat Effects](#stat-effects). |
| `item` | No (repeatable) | Grants or removes inventory items. See [Inventory Effects](#inventory-effects). |
| `roll` | No (max once) | Declares a dice roll. See [Roll Directives](#roll-directives). |
| `optional` | No (max once) | Hides the entire choice when its condition is false. See [Conditions](#conditions). |
| `valid` | No (max once) | Keeps the choice visible but disables interaction until its condition is true. |

If both `optional` and `valid` are omitted, the choice is always shown and enabled.

## Stat Effects

```
stat = strength+1
stat = luck-(2)
stat = focus+roll
```

- Syntax: `<statName><+|-><value>`
- `statName` is recorded verbatim but comparisons are case-sensitive when matching against configured stats (loaded from `assets/stats.config` and normalised to lowercase).
- `<value>` can be:
  - A number (e.g., `3`, `-2`, `(1)`).
  - A dynamic keyword referencing the latest roll:
    - `roll`, `total`, `x`: adds the roll total.
    - `dice`, `roll-dice`: adds the sum of the dice only.
    - `stat`, `roll-stat`, `modifier`: adds the stat modifier used in the roll.
- Prepend a minus sign using the operator (`-`) to invert the value. Dynamic keywords respect the sign (e.g., `stat=strength-roll` subtracts the roll total).
- You may include multiple `stat=` directives on a single choice; they are evaluated in order.

## Inventory Effects

```
item = Keycard+
item = Credits+3
item = Lockpick-
item = Ammo-5
```

- Syntax: `<itemName><+|-><count?>`
- `count` defaults to `1` when omitted.
- A `+` adds items; `-` removes them (minimum zero). Items reduced to zero are removed from the inventory map.
- Item names are trimmed but otherwise case-sensitive.

## Roll Directives

```
roll = luck, dice=2d6, target=10, ok=A11, fail=A10
```

Tokens are comma-separated. Each token is either `key=value` or a bare label equivalent to `stat=label`. Square brackets around values are optional.

### Supported keys

| Key | Required | Meaning |
|-----|----------|---------|
| `roll` / `stat` | No | Associates the roll with a stat label. Use `none` to clear it. The engine looks up current stat values automatically. |
| *(bare token)* | No | Equivalent to `stat=<token>`. |
| `dice` | No | Dice expression as `XdY` or just `Y`. Defaults to `1d6`. |
| `target` | Yes | Number the roll must meet or exceed. |
| `ok` | Yes | Branch ID to jump to when the roll succeeds. |
| `fail` | Yes | Branch ID to jump to when the roll fails. |

When a roll is declared:

1. Optional stat modifiers are applied.
2. Dice are rolled using `runRoll` in `js/rollSystem.js`.
3. The total is compared against `target`.
4. Choice-level `stat`/`item` effects are processed after the outcome is known (they run once, regardless of success or failure).
5. The engine transitions to `ok` or `fail`.

A rolled choice does not need `next`, but you may still include it if the roll is omitted.

## Conditions

`optional` and `valid` directives both expect a condition in the format `keyword(arg1, arg2, ...)`. Arguments are comma-separated and trimmed. Keywords are case-insensitive; underscores or hyphens are interchangeable (e.g., `visited-any`, `visited_any`).

### Supported keywords

| Keyword variants | Kind | Behaviour |
|------------------|------|-----------|
| `visited`, `visited-all` | `visited-all` | True only if the player has already visited **every** listed branch ID. |
| `visitedAny`, `visited-any` | `visited-any` | True if **any** listed branch ID has been visited. |
| `visitedNone`, `visited-none`, `not-visited`, `unvisited` | `visited-none` | True if **none** of the listed branch IDs have been visited yet. |
| `has`, `inventory`, `has-all` | `inventory-all` | True when the inventory contains **all** listed item names (count ≥ 1). |
| `hasAny`, `inventory-any` | `inventory-any` | True when the inventory contains at least **one** of the listed items. |

### Examples

```
Choice: display=[Ask about the relic]; next=C5; optional=visited(B2, B3)
Choice: display=[Unlock the vault]; next=V2; valid=has(Keycard, Access Badge)
Choice: display=[Use emergency beacon]; next=E1; optional=hasAny(Distress Flare, S.O.S. Transmitter)
```

- `optional`: hides the choice completely when false.
- `valid`: renders the button disabled (muted styling) until the condition becomes true.
- Conditions evaluate against the live game state and update automatically on subsequent renders.

## Branch Linking Rules

- Every branch ID must be unique; duplicates cause a parser error.
- `next`, `ok`, and `fail` destinations must reference existing branch IDs at runtime. Missing branches trigger in-game error messages.
- It is safe to reference a branch before it is defined; the parser resolves links after reading the entire file.

## Additional Notes

- The parser is strict: malformed directives, unknown keys, or missing required parameters halt loading with descriptive error messages. Validate story files after editing.
- `assets/stats.config` defines which stats are tracked. Only those stats can be modified or rolled against.
- The engine records the visit history (`visitedBranches`) and exposes it to the condition system and save files. Branch visits are logged automatically when `setCurrentBranch` is called—no story authoring is required.

## Authoring Checklist

1. Ensure every branch includes `Title`, `Branch`, `Description`, and at least one `Choice`.
2. Verify `next` / `ok` / `fail` targets exist to avoid dead ends.
3. Prefer bracketed values (`[text]`) when labels contain punctuation or leading/trailing spaces.
4. Use comments (`# ...`) to annotate complex sequences without affecting the game.
5. Play through new content and check the browser console for parser warnings or unknown stats/items.
