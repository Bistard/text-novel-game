"use strict";

const fs = require("fs");
const path = require("path");

function parseStory(text) {
  const blocks = text.split(/\r?\n\s*\r?\n/g);
  const nodes = new Map(); // branch -> { title }
  const edges = []; // { from, to, label }

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    const titleMatch = block.match(/^Title:\s*(.+)$/m);
    const branchMatch = block.match(/^Branch:\s*([^\r\n]+)$/m);
    const title = (titleMatch ? titleMatch[1] : "").trim();
    const branch = (branchMatch ? branchMatch[1] : "").trim();
    if (!branch) continue;
    if (!nodes.has(branch)) nodes.set(branch, { title: title || branch });

    const choiceLines = block.match(/^Choice:\s*(.+)$/gm) || [];
    for (const choiceLine of choiceLines) {
      const entry = choiceLine.replace(/^Choice:\s*/, "").trim();

      const display = (entry.match(/display=\[([^\]]*)\]/)?.[1] || "").trim();

      // Roll-based branching
      const hasRoll = /\broll=/.test(entry);
      if (hasRoll) {
        const okMatch = entry.match(/\bok=([A-Za-z0-9_]+)/i);
        const failMatch = entry.match(/\bfail=([A-Za-z0-9_]+)/i);
        const dice = entry.match(/\bdice=([^,;]+)/i)?.[1]?.trim();
        const target = entry.match(/\btarget=([^,;]+)/i)?.[1]?.trim();
        const base = display || [dice ? `Roll ${dice}` : "Roll", target ? `target ${target}` : ""].filter(Boolean).join(" ");

        if (okMatch) {
          edges.push({ from: branch, to: okMatch[1], label: `${base}: success` });
        }
        if (failMatch) {
          edges.push({ from: branch, to: failMatch[1], label: `${base}: fail` });
        }
        continue;
      }

      // Standard next branching
      const nextMatch = entry.match(/\bnext=([A-Za-z0-9_]+)/);
      if (nextMatch) {
        const to = nextMatch[1];
        const itemMatches = [...entry.matchAll(/\bitem=([^;]+)/g)].map((m) => m[1].trim());
        let label = display;
        if (itemMatches.length) {
          const items = itemMatches.join(", ");
          label = label ? `${label} - ${items}` : items;
        }
        edges.push({ from: branch, to, label: label || "" });
      }
    }
  }

  return { nodes, edges };
}

function escapeLabel(s) {
  return String(s || "").replace(/"/g, '\\"');
}

function sanitizeEdgeLabel(s) {
  if (!s) return "";
  // Remove characters that confuse Mermaid link labels
  let out = String(s).replace(/[\[\]{}<>|`"()]/g, "");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function toMermaid(nodes, edges) {
  const usedIds = new Set();
  const idMap = new Map();
  for (const id of nodes.keys()) {
    idMap.set(id, createMermaidId(id, usedIds));
  }

  const lines = [];
  lines.push("```mermaid");
  lines.push("graph LR");
  lines.push("%% Nodes");

  for (const [id, node] of nodes) {
    const label = escapeLabel(node.title || id);
    const sanitized = idMap.get(id);
    lines.push(`${sanitized}["${label}"]`);
  }

  lines.push("%% Edges");
  for (const e of edges) {
    const lbl = sanitizeEdgeLabel(e.label || "");
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    if (!from || !to) continue;
    lines.push(lbl ? `${from} -->|${lbl}| ${to}` : `${from} --> ${to}`);
  }

  lines.push("classDef default fill:#141a31,stroke:#49d2ff,stroke-width:2px;");
  lines.push("```");
  return lines.join("\n");
}

function createMermaidId(value, usedIds) {
  const base = sanitizeMermaidId(value);
  let candidate = base;
  let counter = 1;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${counter++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function sanitizeMermaidId(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_");
  if (!cleaned) {
    return "Node";
  }
  if (!/^[A-Za-z]/.test(cleaned)) {
    return `N_${cleaned}`;
  }
  return cleaned;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const inputPath = path.join(repoRoot, "assets", "story.txt");
  const outDir = path.join(repoRoot, "assets");
  const outPath = path.join(outDir, "story-flow.md");

  const text = fs.readFileSync(inputPath, "utf8");
  const { nodes, edges } = parseStory(text);
  const mermaid = toMermaid(nodes, edges);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const header = "# Story Flow (assets/story.txt)\n\n";
  fs.writeFileSync(outPath, header + mermaid + "\n", "utf8");

  console.log(`Wrote Mermaid flowchart: ${path.relative(repoRoot, outPath)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
