/**
 * JSON structure builder model.
 *
 * A JSON structure is an interactively built JSON document whose fixed shape
 * (braces, field names, literal values) is authored in the editor and whose
 * generated positions are filled by ITS JSON type placeholders. It serialises
 * to ordinary ITS content elements (text plus placeholders), so templates
 * stay spec-compliant and compile with unmodified compilers; a compiled
 * template containing only a JSON structure prompts a model to return the
 * completed raw JSON document and nothing else.
 *
 * Serialisation is canonical (two-space indentation), and parsing is
 * whitespace-tolerant, so builder-authored element runs round-trip and
 * hand-authored runs in the same shape are recognised too. Elements in a run
 * share an id prefix (jsb-<groupId>-<n>) that the editor uses to group them
 * back into a single builder block.
 */

import type { ContentElement, JsonValue, PlaceholderElement, TextElement } from "./types";

export type JsonGeneratedLeafType = "json_string" | "json_number" | "json_value";

/**
 * The instruction types the builder's serialised elements rely on. Hosts
 * offer the builder only when the palette provides all of them (i.e. the
 * template extends the JSON type library).
 */
export const JSON_STRUCTURE_TYPES = [
  "json_string",
  "json_number",
  "json_value",
  "json_array_items",
  "json_object_fields",
] as const;

export type JsonStructureValue =
  | { kind: "literal"; value: JsonValue }
  | {
      kind: "generated";
      type: JsonGeneratedLeafType;
      description: string;
      numberType?: string;
      valueType?: string;
      displayName?: string;
    }
  | { kind: "object"; entries: JsonObjectEntry[] }
  | { kind: "array"; entries: JsonArrayEntry[] };

export type JsonObjectEntry =
  | { kind: "property"; name: string; value: JsonStructureValue }
  | { kind: "generatedFields"; description: string; fieldCount?: number; displayName?: string };

export type JsonArrayEntry =
  | { kind: "item"; value: JsonStructureValue }
  | { kind: "generatedItems"; description: string; itemType?: string; itemCount?: number; displayName?: string };

/** The root of a builder block is always an object or an array. */
export type JsonStructure = Extract<JsonStructureValue, { kind: "object" } | { kind: "array" }>;

let groupCounter = 0;

export function newJsonStructureGroupId(): string {
  groupCounter += 1;
  return `${Date.now().toString(36)}${groupCounter.toString(36)}`;
}

/** Extracts the group id from an element id of the form jsb-<groupId>-<n>. */
export function jsonStructureGroupId(elementId: string | undefined): string | null {
  const match = elementId === undefined ? null : /^jsb-([a-z0-9]+)-\d+$/.exec(elementId);
  return match ? match[1] : null;
}

export function emptyJsonStructure(): JsonStructure {
  return { kind: "object", entries: [] };
}

/* ------------------------------------------------------------------ */
/* Serialisation                                                       */
/* ------------------------------------------------------------------ */

type Fragment = { kind: "text"; text: string } | { kind: "placeholder"; element: PlaceholderElement };

class FragmentWriter {
  private fragments: Fragment[] = [];
  private buffer = "";

  text(chunk: string): void {
    this.buffer += chunk;
  }

  placeholder(instructionType: string, config: PlaceholderElement["config"]): void {
    if (this.buffer.length > 0) {
      this.fragments.push({ kind: "text", text: this.buffer });
      this.buffer = "";
    }
    this.fragments.push({ kind: "placeholder", element: { type: "placeholder", instructionType, config } });
  }

  finish(groupId: string): ContentElement[] {
    if (this.buffer.length > 0) {
      this.fragments.push({ kind: "text", text: this.buffer });
      this.buffer = "";
    }
    return this.fragments.map((fragment, index) => {
      const id = `jsb-${groupId}-${index}`;
      if (fragment.kind === "text") {
        const element: TextElement = { type: "text", text: fragment.text, id };
        return element;
      }
      return { ...fragment.element, id };
    });
  }
}

function indentContinuationLines(text: string, indent: number): string {
  const pad = " ".repeat(indent);
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? line : pad + line))
    .join("\n");
}

function writeValue(writer: FragmentWriter, value: JsonStructureValue, indent: number): void {
  if (value.kind === "literal") {
    writer.text(indentContinuationLines(JSON.stringify(value.value, null, 2), indent));
    return;
  }
  if (value.kind === "generated") {
    const config: PlaceholderElement["config"] = { description: value.description };
    if (value.displayName !== undefined) config.displayName = value.displayName;
    if (value.type === "json_number") config.numberType = value.numberType ?? "any";
    if (value.type === "json_value") config.valueType = value.valueType ?? "any";
    writer.placeholder(value.type, config);
    return;
  }
  if (value.kind === "object") {
    writeObject(writer, value.entries, indent);
    return;
  }
  writeArray(writer, value.entries, indent);
}

function writeObject(writer: FragmentWriter, entries: JsonObjectEntry[], indent: number): void {
  if (entries.length === 0) {
    writer.text("{}");
    return;
  }
  const pad = " ".repeat(indent + 2);
  writer.text("{\n");
  entries.forEach((entry, index) => {
    writer.text(pad);
    if (entry.kind === "property") {
      writer.text(`${JSON.stringify(entry.name)}: `);
      writeValue(writer, entry.value, indent + 2);
    } else {
      const config: PlaceholderElement["config"] = { description: entry.description };
      if (entry.displayName !== undefined) config.displayName = entry.displayName;
      if (entry.fieldCount !== undefined) config.fieldCount = entry.fieldCount;
      writer.placeholder("json_object_fields", config);
    }
    writer.text(index < entries.length - 1 ? ",\n" : "\n");
  });
  writer.text(`${" ".repeat(indent)}}`);
}

function writeArray(writer: FragmentWriter, entries: JsonArrayEntry[], indent: number): void {
  if (entries.length === 0) {
    writer.text("[]");
    return;
  }
  const pad = " ".repeat(indent + 2);
  writer.text("[\n");
  entries.forEach((entry, index) => {
    writer.text(pad);
    if (entry.kind === "item") {
      writeValue(writer, entry.value, indent + 2);
    } else {
      const config: PlaceholderElement["config"] = { description: entry.description };
      if (entry.displayName !== undefined) config.displayName = entry.displayName;
      config.itemType = entry.itemType ?? "any";
      if (entry.itemCount !== undefined) config.itemCount = entry.itemCount;
      writer.placeholder("json_array_items", config);
    }
    writer.text(index < entries.length - 1 ? ",\n" : "\n");
  });
  writer.text(`${" ".repeat(indent)}]`);
}

/** Serialises a JSON structure to ITS content elements with grouped ids. */
export function serialiseJsonStructure(structure: JsonStructure, groupId: string = newJsonStructureGroupId()): ContentElement[] {
  const writer = new FragmentWriter();
  writeValue(writer, structure, 0);
  return writer.finish(groupId);
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

class ParseFailure extends Error {}

class FragmentReader {
  private fragmentIndex = 0;
  private charIndex = 0;
  private readonly fragments: Fragment[];

  constructor(elements: ContentElement[]) {
    this.fragments = elements.map((element) => {
      if (element.type === "text") return { kind: "text", text: element.text };
      if (element.type === "placeholder") return { kind: "placeholder", element };
      throw new ParseFailure("conditional elements are not part of JSON structures");
    });
  }

  private normalise(): void {
    while (this.fragmentIndex < this.fragments.length) {
      const fragment = this.fragments[this.fragmentIndex];
      if (fragment.kind === "text" && this.charIndex >= fragment.text.length) {
        this.fragmentIndex += 1;
        this.charIndex = 0;
      } else {
        break;
      }
    }
  }

  peekChar(): string | null {
    this.normalise();
    const fragment = this.fragments[this.fragmentIndex];
    return fragment !== undefined && fragment.kind === "text" ? fragment.text[this.charIndex] : null;
  }

  nextChar(): string {
    const char = this.peekChar();
    if (char === null) throw new ParseFailure("unexpected end of content");
    this.charIndex += 1;
    return char;
  }

  expectChar(expected: string): void {
    const char = this.nextChar();
    if (char !== expected) throw new ParseFailure(`expected ${expected} but found ${char}`);
  }

  peekPlaceholder(): PlaceholderElement | null {
    this.normalise();
    const fragment = this.fragments[this.fragmentIndex];
    return fragment !== undefined && fragment.kind === "placeholder" ? fragment.element : null;
  }

  takePlaceholder(): PlaceholderElement {
    const placeholder = this.peekPlaceholder();
    if (placeholder === null) throw new ParseFailure("expected a placeholder");
    this.fragmentIndex += 1;
    this.charIndex = 0;
    return placeholder;
  }

  skipWhitespace(): void {
    for (;;) {
      const char = this.peekChar();
      if (char === null || !/\s/.test(char)) return;
      this.charIndex += 1;
    }
  }

  atEnd(): boolean {
    this.normalise();
    return this.fragmentIndex >= this.fragments.length;
  }
}

function stringOption(config: PlaceholderElement["config"], key: string): string | undefined {
  const value = config[key];
  return typeof value === "string" ? value : undefined;
}

function numberOption(config: PlaceholderElement["config"], key: string): number | undefined {
  const value = config[key];
  return typeof value === "number" ? value : undefined;
}

function parseGeneratedLeaf(placeholder: PlaceholderElement): JsonStructureValue {
  const type = placeholder.instructionType as JsonGeneratedLeafType;
  const leaf: JsonStructureValue = {
    kind: "generated",
    type,
    description: placeholder.config.description ?? "",
  };
  const displayName = stringOption(placeholder.config, "displayName");
  if (displayName !== undefined) leaf.displayName = displayName;
  if (type === "json_number") leaf.numberType = stringOption(placeholder.config, "numberType") ?? "any";
  if (type === "json_value") leaf.valueType = stringOption(placeholder.config, "valueType") ?? "any";
  return leaf;
}

function parseStringLiteral(reader: FragmentReader): string {
  let raw = "";
  reader.expectChar('"');
  raw += '"';
  for (;;) {
    const char = reader.nextChar();
    raw += char;
    if (char === "\\") {
      raw += reader.nextChar();
    } else if (char === '"') {
      break;
    }
  }
  try {
    return JSON.parse(raw) as string;
  } catch {
    throw new ParseFailure(`invalid string literal ${raw}`);
  }
}

function parseNumberLiteral(reader: FragmentReader): number {
  let raw = "";
  for (;;) {
    const char = reader.peekChar();
    if (char === null || !/[0-9eE+\-.]/.test(char)) break;
    raw += reader.nextChar();
  }
  const value = Number(raw);
  if (raw === "" || Number.isNaN(value)) throw new ParseFailure(`invalid number literal ${raw}`);
  return value;
}

function parseKeyword(reader: FragmentReader): JsonValue {
  let raw = "";
  for (;;) {
    const char = reader.peekChar();
    if (char === null || !/[a-z]/.test(char)) break;
    raw += reader.nextChar();
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  throw new ParseFailure(`unexpected token ${raw}`);
}

function parseValue(reader: FragmentReader): JsonStructureValue {
  reader.skipWhitespace();
  const placeholder = reader.peekPlaceholder();
  if (placeholder !== null) {
    if (["json_string", "json_number", "json_value"].includes(placeholder.instructionType)) {
      return parseGeneratedLeaf(reader.takePlaceholder());
    }
    throw new ParseFailure(`placeholder ${placeholder.instructionType} is not valid at a value position`);
  }
  const char = reader.peekChar();
  if (char === null) throw new ParseFailure("expected a value");
  if (char === "{") return parseObject(reader);
  if (char === "[") return parseArray(reader);
  if (char === '"') return { kind: "literal", value: parseStringLiteral(reader) };
  if (/[-0-9]/.test(char)) return { kind: "literal", value: parseNumberLiteral(reader) };
  return { kind: "literal", value: parseKeyword(reader) };
}

function parseObject(reader: FragmentReader): JsonStructureValue {
  reader.expectChar("{");
  const entries: JsonObjectEntry[] = [];
  reader.skipWhitespace();
  if (reader.peekChar() === "}") {
    reader.nextChar();
    return { kind: "object", entries };
  }
  for (;;) {
    reader.skipWhitespace();
    const placeholder = reader.peekPlaceholder();
    if (placeholder !== null && placeholder.instructionType === "json_object_fields") {
      const element = reader.takePlaceholder();
      const entry: JsonObjectEntry = { kind: "generatedFields", description: element.config.description ?? "" };
      const displayName = stringOption(element.config, "displayName");
      if (displayName !== undefined) entry.displayName = displayName;
      const fieldCount = numberOption(element.config, "fieldCount");
      if (fieldCount !== undefined) entry.fieldCount = fieldCount;
      entries.push(entry);
    } else {
      const name = parseStringLiteral(reader);
      reader.skipWhitespace();
      reader.expectChar(":");
      entries.push({ kind: "property", name, value: parseValue(reader) });
    }
    reader.skipWhitespace();
    const next = reader.nextChar();
    if (next === "}") return { kind: "object", entries };
    if (next !== ",") throw new ParseFailure(`expected , or } but found ${next}`);
  }
}

function parseArray(reader: FragmentReader): JsonStructureValue {
  reader.expectChar("[");
  const entries: JsonArrayEntry[] = [];
  reader.skipWhitespace();
  if (reader.peekChar() === "]") {
    reader.nextChar();
    return { kind: "array", entries };
  }
  for (;;) {
    reader.skipWhitespace();
    const placeholder = reader.peekPlaceholder();
    if (placeholder !== null && placeholder.instructionType === "json_array_items") {
      const element = reader.takePlaceholder();
      const entry: JsonArrayEntry = {
        kind: "generatedItems",
        description: element.config.description ?? "",
        itemType: stringOption(element.config, "itemType") ?? "any",
      };
      const displayName = stringOption(element.config, "displayName");
      if (displayName !== undefined) entry.displayName = displayName;
      const itemCount = numberOption(element.config, "itemCount");
      if (itemCount !== undefined) entry.itemCount = itemCount;
      entries.push(entry);
    } else {
      entries.push({ kind: "item", value: parseValue(reader) });
    }
    reader.skipWhitespace();
    const next = reader.nextChar();
    if (next === "]") return { kind: "array", entries };
    if (next !== ",") throw new ParseFailure(`expected , or ] but found ${next}`);
  }
}

/**
 * Parses a run of content elements back into a JSON structure. Returns null
 * when the run is not a recognisable structure (for example after free-form
 * hand edits), in which case the editor falls back to plain blocks.
 */
export function parseJsonStructure(elements: ContentElement[]): JsonStructure | null {
  try {
    const reader = new FragmentReader(elements);
    const value = parseValue(reader);
    reader.skipWhitespace();
    if (!reader.atEnd()) return null;
    if (value.kind !== "object" && value.kind !== "array") return null;
    return value;
  } catch {
    return null;
  }
}
