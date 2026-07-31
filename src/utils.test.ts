import { describe, expect, it } from "vitest";
import { textLayout } from "./utils";

describe("textLayout", () => {
  it("classifies newline-only text as a line break", () => {
    expect(textLayout("\n")).toBe("break");
    expect(textLayout("\n\n")).toBe("break");
    expect(textLayout("\n\n\n")).toBe("break");
  });

  it("classifies single-line text as inline", () => {
    expect(textLayout("")).toBe("inline");
    expect(textLayout("# ")).toBe("inline");
    expect(textLayout("plain text with ${vars}")).toBe("inline");
  });

  it("classifies text with embedded newlines as a block", () => {
    expect(textLayout("## Key features\n")).toBe("block");
    expect(textLayout("\n\n## Key features\n\n")).toBe("block");
    expect(textLayout("line one\nline two")).toBe("block");
  });
});
