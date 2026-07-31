import { describe, expect, it } from "vitest";
import { buildVariableTree, type VariableTreeNode } from "./components/VariableField";
import { parseJsonStructure, serialiseJsonStructure, type JsonStructure } from "./jsonStructure";

function find(nodes: VariableTreeNode[], label: string): VariableTreeNode | undefined {
  return nodes.find((node) => node.label === label);
}

describe("buildVariableTree", () => {
  const variables = {
    location: "Sydney",
    forecast: [
      { day: "Monday", high: 24 },
      { day: "Tuesday", high: 31 },
    ],
    settings: { theme: "dark", level: 3 },
  };

  it("nests object properties and array indices", () => {
    const tree = buildVariableTree(variables, true);

    expect(find(tree, "location")?.insertPath).toBe("location");
    const forecast = find(tree, "forecast");
    expect(forecast?.insertPath).toBe("forecast");
    const first = find(forecast?.children ?? [], "[0]");
    expect(first?.insertPath).toBe("forecast[0]");
    expect(find(first?.children ?? [], "day")?.insertPath).toBe("forecast[0].day");
    const settings = find(tree, "settings");
    expect(find(settings?.children ?? [], "theme")?.insertPath).toBe("settings.theme");
  });

  it("offers length and collection functions on arrays", () => {
    const tree = buildVariableTree(variables, true);
    const forecast = find(tree, "forecast");

    expect(find(forecast?.children ?? [], ".length")?.insertPath).toBe("forecast.length");
    const sum = find(forecast?.children ?? [], "sum(…)");
    expect(find(sum?.children ?? [], "high")?.insertPath).toBe("forecast.sum(high)");
    const concat = find(forecast?.children ?? [], "concat(…)");
    expect(find(concat?.children ?? [], "day")?.insertPath).toBe("forecast.concat(day)");
    const top = find(forecast?.children ?? [], "top(…)");
    expect(find(top?.children ?? [], "3")?.insertPath).toBe("forecast.top(3)");
  });

  it("omits functions in bare mode for condition fields", () => {
    const tree = buildVariableTree(variables, false);
    const forecast = find(tree, "forecast");

    expect(find(forecast?.children ?? [], "sum(…)")).toBeUndefined();
    expect(find(forecast?.children ?? [], ".length")?.insertPath).toBe("forecast.length");
  });
});

describe("null fixed values", () => {
  it("round-trips a null literal through the JSON structure", () => {
    const structure: JsonStructure = {
      kind: "object",
      entries: [{ kind: "property", name: "middleName", value: { kind: "literal", value: null } }],
    };
    const elements = serialiseJsonStructure(structure, "nulltest");
    expect(elements.some((e) => e.type === "text" && e.text.includes('"middleName": null'))).toBe(true);
    expect(parseJsonStructure(elements)).toEqual(structure);
  });
});
