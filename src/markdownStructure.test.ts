import { describe, expect, it } from "vitest";
import {
  isHorizontalRuleText,
  parseHeadingText,
  parseMarkdownCode,
  parseMarkdownTable,
  serialiseHeadingText,
  serialiseMarkdownCode,
  serialiseMarkdownTable,
  type MarkdownCodeModel,
  type MarkdownTableModel,
} from "./markdownStructure";

describe("heading and horizontal rule shapes", () => {
  it("parses and serialises headings", () => {
    expect(parseHeadingText("## Key features")).toEqual({ level: 2, content: "Key features" });
    expect(parseHeadingText("# ${product} ${releaseVersion} - ")).toEqual({
      level: 1,
      content: "${product} ${releaseVersion} - ",
    });
    expect(serialiseHeadingText(3, "Notes")).toBe("### Notes");
    expect(parseHeadingText("####### too deep")).toBeNull();
    expect(parseHeadingText("plain text")).toBeNull();
    expect(parseHeadingText("## multi\nline")).toBeNull();
  });

  it("recognises horizontal rules", () => {
    expect(isHorizontalRuleText("---")).toBe(true);
    expect(isHorizontalRuleText("-----")).toBe(true);
    expect(isHorizontalRuleText("--")).toBe(false);
    expect(isHorizontalRuleText("--- x")).toBe(false);
  });
});

describe("markdown code blocks", () => {
  it("round-trips a generated body with language", () => {
    const model: MarkdownCodeModel = {
      language: "bash",
      body: { kind: "generated", description: "upgrade commands", displayName: "Upgrade" },
    };
    const elements = serialiseMarkdownCode(model, "g1");

    expect(elements.map((e) => (e.type === "text" ? e.text : "<ph>"))).toEqual(["```bash", "\n", "<ph>", "\n", "```"]);
    expect(elements[2]).toMatchObject({
      instructionType: "markdown_code",
      config: { description: "upgrade commands", displayName: "Upgrade", language: "bash" },
    });
    expect(parseMarkdownCode(elements)).toEqual(model);
  });

  it("round-trips a fixed body without language", () => {
    const model: MarkdownCodeModel = { language: "", body: { kind: "fixed", code: "npm install\nnpm test" } };
    const elements = serialiseMarkdownCode(model, "g2");

    expect(elements[0]).toMatchObject({ type: "text", text: "```" });
    expect(parseMarkdownCode(elements)).toEqual(model);
  });

  it("rejects malformed runs", () => {
    const elements = serialiseMarkdownCode({ language: "", body: { kind: "fixed", code: "x" } }, "g3");
    expect(parseMarkdownCode(elements.slice(0, 4))).toBeNull();
  });
});

describe("markdown tables", () => {
  it("round-trips a generated body and emits the columns count", () => {
    const model: MarkdownTableModel = {
      columns: ["Issue", "Severity", "Summary"],
      body: { kind: "generated", description: "plausible fixed issues", displayName: "Rows", rowCount: 3 },
    };
    const elements = serialiseMarkdownTable(model, "t1");

    expect(elements[0]).toMatchObject({
      type: "text",
      text: "| Issue | Severity | Summary |\n| --- | --- | --- |",
    });
    expect(elements[2]).toMatchObject({
      instructionType: "markdown_table_rows",
      config: { description: "plausible fixed issues", displayName: "Rows", rows: 3, columns: 3 },
    });
    expect(parseMarkdownTable(elements)).toEqual(model);
  });

  it("round-trips literal rows", () => {
    const model: MarkdownTableModel = {
      columns: ["Name", "Value"],
      body: { kind: "rows", rows: [["alpha", "1"], ["beta", "2"]] },
    };
    const elements = serialiseMarkdownTable(model, "t2");

    expect(elements[2]).toMatchObject({ type: "text", text: "| alpha | 1 |\n| beta | 2 |" });
    expect(parseMarkdownTable(elements)).toEqual(model);
  });

  it("rejects mismatched separator widths", () => {
    const elements = serialiseMarkdownTable(
      { columns: ["A", "B"], body: { kind: "rows", rows: [["x", "y"]] } },
      "t3",
    );
    const head = elements[0];
    if (head.type === "text") head.text = "| A | B |\n| --- |";
    expect(parseMarkdownTable(elements)).toBeNull();
  });
});
