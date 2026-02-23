/**
 * Markdown text-manipulation helpers for the rich toolbar.
 *
 * Each helper receives the full editor text, selection start/end,
 * and returns { text, selectionStart, selectionEnd } so the caller
 * can update the textarea value + cursor in one shot.
 */

export interface EditorState {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

// ─── Inline wrapping (**…**, *…*, etc.) ────

export function wrapSelection(
  state: EditorState,
  prefix: string,
  suffix: string,
): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd);
  const after = text.slice(selectionEnd);

  const newText = before + prefix + selected + suffix + after;

  // If nothing was selected, place cursor inside the wrapper
  if (selectionStart === selectionEnd) {
    const cursor = selectionStart + prefix.length;
    return { text: newText, selectionStart: cursor, selectionEnd: cursor };
  }

  // Keep selection around the wrapped content
  return {
    text: newText,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionEnd + prefix.length,
  };
}

// ─── Bold (**text**) ────────────────────────────────────

export function insertBold(state: EditorState): EditorState {
  return wrapSelection(state, "**", "**");
}

// ─── Italic (*text*) ───────────────────────────────────

export function insertItalic(state: EditorState): EditorState {
  return wrapSelection(state, "*", "*");
}

// ─── Strikethrough (~~text~~) ──────────────────────────

export function insertStrikethrough(state: EditorState): EditorState {
  return wrapSelection(state, "~~", "~~");
}

// ─── Inline Code (`code`) ──────────────────────────────

export function insertInlineCode(state: EditorState): EditorState {
  return wrapSelection(state, "`", "`");
}

// ─── Section / Heading helpers ─────────────────────────────

export function insertHeading(
  state: EditorState,
  level: "h1" | "h2" | "h3" | "h4",
): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const hashes: Record<string, string> = {
    h1: "# ",
    h2: "## ",
    h3: "### ",
    h4: "#### ",
  };

  const prefix = hashes[level];
  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const line = `${ensureNewline}${prefix}${selected}\n`;
  const newText = before + line + after;

  if (!selected) {
    const cursor = before.length + ensureNewline.length + prefix.length;
    return { text: newText, selectionStart: cursor, selectionEnd: cursor };
  }

  return {
    text: newText,
    selectionStart: before.length + ensureNewline.length + prefix.length,
    selectionEnd: before.length + ensureNewline.length + prefix.length + selected.length,
  };
}

// ─── List helpers ───────────────────────────────────────

export function insertList(state: EditorState, type: "bullet" | "ordered"): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";

  if (selected) {
    const items = selected
      .split("\n")
      .filter((l) => l.trim())
      .map((l, i) => (type === "bullet" ? `- ${l.trim()}` : `${i + 1}. ${l.trim()}`))
      .join("\n");
    const block = `${ensureNewline}${items}\n`;
    const newText = before + block + after;
    const cursorPos = before.length + block.length;
    return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
  }

  const template = type === "bullet" ? `${ensureNewline}- ` : `${ensureNewline}1. `;
  const newText = before + template + after;
  const cursorPos = before.length + template.length;
  return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
}

// ─── Code block (```...```) ─────────────────────────────

export function insertCodeBlock(state: EditorState): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const block = `${ensureNewline}\`\`\`\n${selected}\n\`\`\`\n`;
  const newText = before + block + after;

  const cursorPos = before.length + ensureNewline.length + 4 + selected.length;
  return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
}

// ─── Blockquote (> ...) ─────────────────────────────────

export function insertQuote(state: EditorState): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";

  if (selected) {
    const quoted = selected
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
    const block = `${ensureNewline}${quoted}\n`;
    const newText = before + block + after;
    const cursorPos = before.length + block.length;
    return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
  }

  const template = `${ensureNewline}> `;
  const newText = before + template + after;
  const cursorPos = before.length + template.length;
  return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
}

// ─── Link [text](url) ──────────────────────────────────

export function insertLink(state: EditorState, url: string, label: string): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const linkText = `[${label}](${url})`;
  const newText = before + linkText + after;
  const cursorEnd = before.length + linkText.length;

  return { text: newText, selectionStart: cursorEnd, selectionEnd: cursorEnd };
}

// ─── Horizontal Rule ────────────────────────────────────

export function insertHorizontalRule(state: EditorState): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const rule = `${ensureNewline}\n---\n\n`;
  const newText = before + rule + after;
  const cursorPos = before.length + rule.length;

  return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
}

// ─── Table ──────────────────────────────────────────────

export function insertTable(state: EditorState, cols: number, rows: number): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";

  // Header row
  const headers = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`);
  const headerRow = `| ${headers.join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

  // Body rows
  const bodyRows = Array.from({ length: Math.max(rows - 1, 1) }, () =>
    `| ${Array.from({ length: cols }, () => " ").join(" | ")} |`,
  );

  const table = `${ensureNewline}\n${headerRow}\n${separatorRow}\n${bodyRows.join("\n")}\n\n`;
  const newText = before + table + after;
  const cursorPos = before.length + table.length;

  return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
}

// ─── Image ![alt](url) ─────────────────────────────────

export function insertImage(state: EditorState, imagePath: string, alt = "image"): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const cmd = `${ensureNewline}![${alt}](${imagePath})\n`;
  const newText = before + cmd + after;
  const cursorPos = before.length + cmd.length;

  return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
}
