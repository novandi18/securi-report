/**
 * LaTeX text-manipulation helpers for the rich toolbar.
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

// ─── Inline wrapping (\textbf{…}, \textit{…}, etc.) ────

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

  // If nothing was selected, place cursor inside the braces
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

export function wrapInlineCommand(state: EditorState, cmd: string): EditorState {
  return wrapSelection(state, `\\${cmd}{`, "}");
}

// ─── Block environments (\begin{…}…\end{…}) ────────────

export function insertEnvironment(
  state: EditorState,
  env: string,
  innerTemplate?: string,
): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";

  let body: string;
  if (selected) {
    body = selected;
  } else if (innerTemplate) {
    body = innerTemplate;
  } else {
    body = "";
  }

  const block = `${ensureNewline}\\begin{${env}}\n${body}\n\\end{${env}}\n`;
  const newText = before + block + after;

  // Place cursor on the body line
  const cursorPos = before.length + ensureNewline.length + `\\begin{${env}}\n`.length + body.length;

  return {
    text: newText,
    selectionStart: cursorPos,
    selectionEnd: cursorPos,
  };
}

// ─── List helpers ───────────────────────────────────────

export function insertList(state: EditorState, type: "itemize" | "enumerate"): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);

  if (selected) {
    // Convert each non-empty line to \item
    const items = selected
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => `  \\item ${l.trim()}`)
      .join("\n");
    return insertEnvironmentRaw(state, type, items);
  }

  return insertEnvironmentRaw(state, type, "  \\item ");
}

function insertEnvironmentRaw(
  state: EditorState,
  env: string,
  body: string,
): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const block = `${ensureNewline}\\begin{${env}}\n${body}\n\\end{${env}}\n`;
  const newText = before + block + after;

  const cursorPos = before.length + ensureNewline.length + `\\begin{${env}}\n`.length + body.length;

  return {
    text: newText,
    selectionStart: cursorPos,
    selectionEnd: cursorPos,
  };
}

// ─── Section commands ───────────────────────────────────

export function insertSection(
  state: EditorState,
  level: "section" | "subsection" | "subsubsection",
): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const line = `${ensureNewline}\\${level}{${selected}}\n`;
  const newText = before + line + after;

  if (!selected) {
    const cursor = before.length + ensureNewline.length + `\\${level}{`.length;
    return { text: newText, selectionStart: cursor, selectionEnd: cursor };
  }

  return {
    text: newText,
    selectionStart: before.length + ensureNewline.length + `\\${level}{`.length,
    selectionEnd: before.length + ensureNewline.length + `\\${level}{`.length + selected.length,
  };
}

// ─── Link (\href{url}{text}) ────────────────────────────

export function insertLink(state: EditorState, url: string, label: string): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const linkText = `\\href{${url}}{${label}}`;
  const newText = before + linkText + after;
  const cursorEnd = before.length + linkText.length;

  return { text: newText, selectionStart: cursorEnd, selectionEnd: cursorEnd };
}

// ─── Alignment (\begin{center} etc.) ────────────────────

export function insertAlignment(
  state: EditorState,
  align: "center" | "flushleft" | "flushright",
): EditorState {
  return insertEnvironment(state, align);
}

// ─── Code block ─────────────────────────────────────────

export function insertCodeBlock(state: EditorState): EditorState {
  return insertEnvironment(state, "lstlisting");
}

// ─── Quote block ────────────────────────────────────────

export function insertQuote(state: EditorState): EditorState {
  return insertEnvironment(state, "quote");
}

// ─── Math ───────────────────────────────────────────────

export function insertInlineMath(state: EditorState): EditorState {
  return wrapSelection(state, "$", "$");
}

export function insertDisplayMath(state: EditorState): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const block = `${ensureNewline}$$\n${selected}\n$$\n`;
  const newText = before + block + after;

  const cursorPos = before.length + ensureNewline.length + 3 + selected.length;
  return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
}

// ─── Table ──────────────────────────────────────────────

export function insertTable(state: EditorState, cols: number, rows: number): EditorState {
  const colSpec = Array(cols).fill("l").join(" | ");
  const headerCells = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`).join(" & ");
  const bodyCells = Array.from({ length: cols }, () => " ").join(" & ");
  const bodyRows = Array.from({ length: rows - 1 }, () => `  ${bodyCells} \\\\`).join("\n");

  const body = `  \\hline\n  ${headerCells} \\\\\n  \\hline\n${bodyRows}\n  \\hline`;

  return insertEnvironmentRaw(state, `tabular}{| ${colSpec} |`, body);
}

// ─── Image (\includegraphics) ───────────────────────────

export function insertImage(state: EditorState, imagePath: string): EditorState {
  const { text, selectionStart, selectionEnd } = state;
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const ensureNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const cmd = `${ensureNewline}\\includegraphics[width=\\textwidth]{${imagePath}}\n`;
  const newText = before + cmd + after;
  const cursorPos = before.length + cmd.length;

  return { text: newText, selectionStart: cursorPos, selectionEnd: cursorPos };
}
