import { describe, expect, it } from "vitest";
import { parseJsonStructure, serialiseJsonStructure, type JsonStructure } from "./jsonStructure";
import type { ContentElement } from "./types";

const model: JsonStructure = {
  kind: "object",
  entries: [
    { kind: "property", name: "id", value: { kind: "generated", type: "json_string", description: "an order id" } },
    { kind: "property", name: "status", value: { kind: "literal", value: "pending" } },
    { kind: "property", name: "page", value: { kind: "numberRef", ref: "${pagination.page}" } },
    { kind: "property", name: "count", value: { kind: "generated", type: "json_number", description: "item count", numberType: "integer" } },
    {
      kind: "property",
      name: "customer",
      value: {
        kind: "object",
        entries: [
          { kind: "property", name: "name", value: { kind: "generated", type: "json_string", description: "a name" } },
          { kind: "property", name: "verified", value: { kind: "literal", value: true } },
          { kind: "generatedFields", description: "two extra contact fields", fieldCount: 2 },
        ],
      },
    },
    {
      kind: "property",
      name: "items",
      value: {
        kind: "array",
        entries: [
          { kind: "item", value: { kind: "literal", value: "fixed-1" } },
          { kind: "generatedItems", description: "two more line items", itemType: "object", itemCount: 2 },
          { kind: "item", value: { kind: "generated", type: "json_value", description: "anything", valueType: "any" } },
        ],
      },
    },
    { kind: "property", name: "tags", value: { kind: "array", entries: [] } },
    { kind: "property", name: "meta", value: { kind: "object", entries: [] } },
  ],
};

const DUMMY_FILLS: Record<string, string> = {
  json_string: '"x"',
  json_number: "1",
  json_value: "null",
  json_array_items: '"a", "b"',
  json_object_fields: '"k": 1',
};

function renderWithDummyFills(elements: ContentElement[]): string {
  return elements
    .map((element) => {
      // ${refs} substitute like a compiler would; numberRef positions
      // receive a bare number so the document parses
      if (element.type === "text") return element.text.replace(/\$\{[^}]+\}/g, "7");
      if (element.type === "placeholder") return DUMMY_FILLS[element.instructionType] ?? "null";
      return "";
    })
    .join("");
}

describe("serialiseJsonStructure", () => {
  it("round-trips through parseJsonStructure", () => {
    const elements = serialiseJsonStructure(model, "test1");
    expect(parseJsonStructure(elements)).toEqual(model);
  });

  it("assigns grouped ids to every element", () => {
    const elements = serialiseJsonStructure(model, "test2");
    for (const element of elements) {
      expect(element.id).toMatch(/^jsb-test2-\d+$/);
    }
  });

  it("produces scaffolding that is valid JSON once fills are substituted", () => {
    const rendered = renderWithDummyFills(serialiseJsonStructure(model, "test3"));
    expect(() => JSON.parse(rendered)).not.toThrow();
    const parsed = JSON.parse(rendered) as Record<string, unknown>;
    expect(parsed.status).toBe("pending");
    expect(parsed.page).toBe(7);
    expect(parsed.items).toEqual(["fixed-1", "a", "b", null]);
  });

  it("canonicalises literal containers into structured entries", () => {
    const withLiteralObject: JsonStructure = {
      kind: "object",
      entries: [{ kind: "property", name: "fixed", value: { kind: "literal", value: { sku: "fixed-1", qty: 1 } } }],
    };
    const parsed = parseJsonStructure(serialiseJsonStructure(withLiteralObject, "test7"));
    expect(parsed).toEqual({
      kind: "object",
      entries: [
        {
          kind: "property",
          name: "fixed",
          value: {
            kind: "object",
            entries: [
              { kind: "property", name: "sku", value: { kind: "literal", value: "fixed-1" } },
              { kind: "property", name: "qty", value: { kind: "literal", value: 1 } },
            ],
          },
        },
      ],
    });
  });

  it("emits explicit type options so compilers without defaults still render", () => {
    const elements = serialiseJsonStructure(model, "test4");
    const numberFill = elements.find((e) => e.type === "placeholder" && e.instructionType === "json_number");
    const itemsFill = elements.find((e) => e.type === "placeholder" && e.instructionType === "json_array_items");
    expect(numberFill?.type === "placeholder" && numberFill.config.numberType).toBe("integer");
    expect(itemsFill?.type === "placeholder" && itemsFill.config.itemType).toBe("object");
  });
});

describe("parseJsonStructure", () => {
  it("tolerates whitespace differences", () => {
    const elements = serialiseJsonStructure(model, "test5").map((element) =>
      element.type === "text" ? { ...element, text: element.text.replace(/\n/g, "\n\n").replace(/ {2}/g, "    ") } : element,
    );
    expect(parseJsonStructure(elements)).toEqual(model);
  });

  it("rejects runs that are not JSON structures", () => {
    expect(parseJsonStructure([{ type: "text", text: "hello world", id: "jsb-x-0" }])).toBeNull();
    expect(
      parseJsonStructure([
        { type: "text", text: "{\n  \"a\": ", id: "jsb-x-0" },
        { type: "placeholder", instructionType: "paragraph", config: { description: "prose" }, id: "jsb-x-1" },
        { type: "text", text: "\n}", id: "jsb-x-2" },
      ]),
    ).toBeNull();
  });

  it("rejects trailing content after the document", () => {
    const elements = [...serialiseJsonStructure(model, "test6"), { type: "text", text: "extra", id: "jsb-test6-99" } as ContentElement];
    expect(parseJsonStructure(elements)).toBeNull();
  });
});
