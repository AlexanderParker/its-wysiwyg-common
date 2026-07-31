import type {
  ConfigPropertySchema,
  ContentElement,
  InstructionTypeDefinition,
  ItsTemplate,
  JsonValue,
  PlaceholderElement,
} from "./types";

let idCounter = 0;

export function nextElementId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function replaceAt<T>(items: T[], index: number, item: T): T[] {
  const copy = items.slice();
  copy[index] = item;
  return copy;
}

export function removeAt<T>(items: T[], index: number): T[] {
  const copy = items.slice();
  copy.splice(index, 1);
  return copy;
}

export function insertAt<T>(items: T[], index: number, item: T): T[] {
  const copy = items.slice();
  copy.splice(index, 0, item);
  return copy;
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const copy = items.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Default config for a new placeholder, derived from the type's config schema. */
export function defaultConfigFor(definition: InstructionTypeDefinition | undefined): PlaceholderElement["config"] {
  const config: PlaceholderElement["config"] = { description: "" };
  const properties = definition?.configSchema?.properties ?? {};
  for (const [name, schema] of Object.entries(properties)) {
    if (schema.default !== undefined) {
      config[name] = schema.default;
    }
  }
  return config;
}

export function coercePropertyValue(schema: ConfigPropertySchema, raw: string): JsonValue {
  if (schema.type === "integer" || schema.type === "number") {
    const parsed = schema.type === "integer" ? parseInt(raw, 10) : parseFloat(raw);
    return Number.isNaN(parsed) ? raw : parsed;
  }
  if (schema.type === "boolean") {
    return raw === "true";
  }
  if (schema.enum && schema.enum.length > 0 && typeof schema.enum[0] === "number") {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? raw : parsed;
  }
  return raw;
}

/**
 * How a text element participates in the document flow: newline-only text
 * is a line break, single-line text flows inline alongside neighbouring
 * elements, and text with embedded newlines takes a full row.
 */
export function textLayout(text: string): "break" | "inline" | "block" {
  if (/^\n+$/.test(text)) {
    return "break";
  }
  return text.includes("\n") ? "block" : "inline";
}

/** All instruction types visible to a template: palette types plus its own custom types. */
export function resolveInstructionTypes(
  template: ItsTemplate,
  paletteTypes: Record<string, InstructionTypeDefinition>,
): Record<string, InstructionTypeDefinition> {
  return { ...paletteTypes, ...(template.customInstructionTypes ?? {}) };
}

/** Extract ${variable} references from a piece of text. */
export function findVariableReferences(text: string): string[] {
  const matches = text.match(/\$\{[^}]+\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -1)))];
}

/** Collect every variable reference used anywhere in a content tree. */
export function collectVariableReferences(elements: ContentElement[]): Set<string> {
  const refs = new Set<string>();
  const visit = (items: ContentElement[]): void => {
    for (const element of items) {
      if (element.type === "text") {
        findVariableReferences(element.text).forEach((r) => refs.add(r));
      } else if (element.type === "placeholder") {
        for (const value of Object.values(element.config)) {
          if (typeof value === "string") {
            findVariableReferences(value).forEach((r) => refs.add(r));
          }
        }
      } else if (element.type === "conditional") {
        visit(element.content);
        if (element.else) visit(element.else);
      }
    }
  };
  visit(elements);
  return refs;
}

/** Returns a content tree with placeholder references to one type renamed. */
export function renameInstructionTypeReferences(
  elements: ContentElement[],
  from: string,
  to: string,
): ContentElement[] {
  return elements.map((element) => {
    if (element.type === "placeholder") {
      return element.instructionType === from ? { ...element, instructionType: to } : element;
    }
    if (element.type === "conditional") {
      const next = {
        ...element,
        content: renameInstructionTypeReferences(element.content, from, to),
      };
      if (element.else) {
        next.else = renameInstructionTypeReferences(element.else, from, to);
      }
      return next;
    }
    return element;
  });
}

export function isItsTemplateShape(value: unknown): value is ItsTemplate {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.version === "string" && Array.isArray(candidate.content);
}

export function formatJsonValue(value: JsonValue): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

/**
 * Parse a variable value typed by the user. Valid JSON is kept as-is
 * (numbers, booleans, arrays, objects); anything else is treated as a
 * plain string so users are not forced to quote text values.
 */
export function parseVariableInput(raw: string): JsonValue {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return raw;
  }
}
