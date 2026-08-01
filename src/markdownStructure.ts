/**
 * Markdown structure blocks.
 *
 * Structural Markdown constructs - headings, horizontal rules, fenced code
 * blocks and tables - are edited through dedicated UI instead of hand-typed
 * syntax, while still serialising to ordinary ITS text and placeholder
 * elements so templates stay spec-compliant and compile unchanged.
 *
 * Headings and horizontal rules are recognised by shape (a single-line text
 * element starting with #-marks, or a dashes-only line) and need no special
 * ids. Code blocks and tables span several elements, grouped by an id
 * prefix (mdc-<groupId>-<n> for code, mdt-<groupId>-<n> for tables) the
 * same way JSON structures use jsb- ids.
 */

import type { ContentElement } from "./types";

let groupCounter = 0;

export function newMarkdownGroupId(): string {
  groupCounter += 1;
  return `${Date.now().toString(36)}${groupCounter.toString(36)}`;
}

export type MarkdownGroupKind = "code" | "table";

/** Extracts the group from an element id of the form mdc-<g>-<n> or mdt-<g>-<n>. */
export function markdownGroupOf(elementId: string | undefined): { kind: MarkdownGroupKind; group: string } | null {
  const match = elementId === undefined ? null : /^md([ct])-([a-z0-9]+)-\d+$/.exec(elementId);
  if (!match) return null;
  return { kind: match[1] === "c" ? "code" : "table", group: match[2] };
}

/* ------------------------------------------------------------------ */
/* Shape-recognised single elements                                    */
/* ------------------------------------------------------------------ */

/** Parses single-line heading text ("## Title") into level and content. */
export function parseHeadingText(text: string): { level: number; content: string } | null {
  const match = /^(#{1,6}) (.*)$/.exec(text);
  if (!match || text.includes("\n")) return null;
  return { level: match[1].length, content: match[2] };
}

export function serialiseHeadingText(level: number, content: string): string {
  return `${"#".repeat(Math.min(6, Math.max(1, level)))} ${content}`;
}

/** A dashes-only line is a Markdown horizontal rule. */
export function isHorizontalRuleText(text: string): boolean {
  return /^-{3,}$/.test(text);
}

/* ------------------------------------------------------------------ */
/* Code blocks                                                         */
/* ------------------------------------------------------------------ */

export type MarkdownCodeBody =
  | { kind: "generated"; description: string; displayName?: string }
  | { kind: "fixed"; code: string };

export interface MarkdownCodeModel {
  language: string;
  body: MarkdownCodeBody;
}

export function serialiseMarkdownCode(model: MarkdownCodeModel, groupId: string = newMarkdownGroupId()): ContentElement[] {
  const id = (n: number): string => `mdc-${groupId}-${n}`;
  const body: ContentElement =
    model.body.kind === "generated"
      ? {
          type: "placeholder",
          instructionType: "markdown_code",
          config: {
            description: model.body.description,
            ...(model.body.displayName !== undefined ? { displayName: model.body.displayName } : {}),
            ...(model.language !== "" ? { language: model.language } : {}),
          },
          id: id(2),
        }
      : { type: "text", text: model.body.code, id: id(2) };
  return [
    { type: "text", text: "```" + model.language, id: id(0) },
    { type: "text", text: "\n", id: id(1) },
    body,
    { type: "text", text: "\n", id: id(3) },
    { type: "text", text: "```", id: id(4) },
  ];
}

export function parseMarkdownCode(elements: ContentElement[]): MarkdownCodeModel | null {
  if (elements.length !== 5) return null;
  const [open, br1, body, br2, close] = elements;
  if (open.type !== "text" || !/^```\S*$/.test(open.text)) return null;
  if (br1.type !== "text" || br1.text !== "\n") return null;
  if (br2.type !== "text" || br2.text !== "\n") return null;
  if (close.type !== "text" || close.text !== "```") return null;
  const language = open.text.slice(3);
  if (body.type === "placeholder") {
    if (body.instructionType !== "markdown_code") return null;
    const displayName = typeof body.config.displayName === "string" ? body.config.displayName : undefined;
    return {
      language,
      body: {
        kind: "generated",
        description: body.config.description ?? "",
        ...(displayName !== undefined ? { displayName } : {}),
      },
    };
  }
  if (body.type === "text" && !body.text.includes("```")) {
    return { language, body: { kind: "fixed", code: body.text } };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export type MarkdownTableBody =
  | { kind: "generated"; description: string; displayName?: string; rowCount?: number }
  | { kind: "rows"; rows: string[][] };

export interface MarkdownTableModel {
  columns: string[];
  body: MarkdownTableBody;
}

function tableRowText(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

export function serialiseMarkdownTable(model: MarkdownTableModel, groupId: string = newMarkdownGroupId()): ContentElement[] {
  const id = (n: number): string => `mdt-${groupId}-${n}`;
  const header = `${tableRowText(model.columns)}\n${tableRowText(model.columns.map(() => "---"))}`;
  const body: ContentElement =
    model.body.kind === "generated"
      ? {
          type: "placeholder",
          instructionType: "markdown_table_rows",
          config: {
            description: model.body.description,
            ...(model.body.displayName !== undefined ? { displayName: model.body.displayName } : {}),
            ...(model.body.rowCount !== undefined ? { rows: model.body.rowCount } : {}),
            columns: model.columns.length,
          },
          id: id(2),
        }
      : { type: "text", text: model.body.rows.map(tableRowText).join("\n"), id: id(2) };
  return [
    { type: "text", text: header, id: id(0) },
    { type: "text", text: "\n", id: id(1) },
    body,
  ];
}

function parseRowCells(line: string): string[] | null {
  const match = /^\| (.*) \|$/.exec(line);
  if (!match) return null;
  return match[1].split(" | ");
}

export function parseMarkdownTable(elements: ContentElement[]): MarkdownTableModel | null {
  if (elements.length !== 3) return null;
  const [head, br, body] = elements;
  if (head.type !== "text" || br.type !== "text" || br.text !== "\n") return null;
  const lines = head.text.split("\n");
  if (lines.length !== 2) return null;
  const columns = parseRowCells(lines[0]);
  const separator = parseRowCells(lines[1]);
  if (columns === null || separator === null) return null;
  if (separator.length !== columns.length || !separator.every((cell) => /^-{3,}$/.test(cell))) return null;
  if (body.type === "placeholder") {
    if (body.instructionType !== "markdown_table_rows") return null;
    const displayName = typeof body.config.displayName === "string" ? body.config.displayName : undefined;
    const rowCount = typeof body.config.rows === "number" ? body.config.rows : undefined;
    return {
      columns,
      body: {
        kind: "generated",
        description: body.config.description ?? "",
        ...(displayName !== undefined ? { displayName } : {}),
        ...(rowCount !== undefined ? { rowCount } : {}),
      },
    };
  }
  if (body.type === "text") {
    const rows: string[][] = [];
    for (const line of body.text.split("\n")) {
      const cells = parseRowCells(line);
      if (cells === null || cells.length !== columns.length) return null;
      rows.push(cells);
    }
    return { columns, body: { kind: "rows", rows } };
  }
  return null;
}

/* ------------------------------------------------------------------ */

export type MarkdownGroupModel =
  | { kind: "code"; model: MarkdownCodeModel }
  | { kind: "table"; model: MarkdownTableModel };

export function parseMarkdownGroup(kind: MarkdownGroupKind, elements: ContentElement[]): MarkdownGroupModel | null {
  if (kind === "code") {
    const model = parseMarkdownCode(elements);
    return model === null ? null : { kind: "code", model };
  }
  const model = parseMarkdownTable(elements);
  return model === null ? null : { kind: "table", model };
}

export function serialiseMarkdownGroup(group: MarkdownGroupModel, groupId: string): ContentElement[] {
  return group.kind === "code"
    ? serialiseMarkdownCode(group.model, groupId)
    : serialiseMarkdownTable(group.model, groupId);
}
