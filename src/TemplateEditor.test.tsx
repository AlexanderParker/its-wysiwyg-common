import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplateEditor } from "./TemplateEditor";
import type { ItsTemplate } from "./types";

afterEach(cleanup);

const template: ItsTemplate = {
  version: "1.0.0",
  metadata: { name: "A template" },
  variables: { audience: "developers" },
  content: [
    { type: "text", text: "Hello" },
    { type: "placeholder", instructionType: "paragraph", config: { description: "an opening line" } },
  ],
};

describe("a read-only editor", () => {
  it("shows the template", () => {
    render(<TemplateEditor value={template} onChange={vi.fn()} readOnly />);

    expect(screen.getByDisplayValue("Hello")).toBeDefined();
  });

  it("leaves every control in the body unusable", () => {
    const { container } = render(<TemplateEditor value={template} onChange={vi.fn()} readOnly />);

    const body = container.querySelector(".its-editor__body");
    expect(body, "the editor body is not the element read-only is applied to").toBeTruthy();

    const controls = body!.querySelectorAll("input, textarea, select, button");
    expect(controls.length, "the content tab rendered nothing to check").toBeGreaterThan(0);
    for (const control of controls) {
      // Disabling the fieldset disables its descendants without setting the
      // attribute on them, which is what :disabled tests and the browser act on.
      expect(control.matches(":disabled"), `${control.tagName} was still usable`).toBe(true);
    }
  });

  it("still moves between tabs, because reading a template means reading all of it", async () => {
    const user = userEvent.setup();
    render(<TemplateEditor value={template} onChange={vi.fn()} readOnly />);

    await user.click(screen.getByRole("tab", { name: /Variables/ }));

    expect(screen.getByDisplayValue("developers")).toBeDefined();
  });

  it("does not call onChange when typing is attempted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TemplateEditor value={template} onChange={onChange} readOnly />);

    await user.type(screen.getByDisplayValue("Hello"), " there");

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("an editable editor", () => {
  it("is the default, and reports edits", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TemplateEditor value={template} onChange={onChange} />);

    await user.type(screen.getByDisplayValue("Hello"), "!");

    expect(onChange).toHaveBeenCalled();
    const [next] = onChange.mock.calls[0] as [ItsTemplate];
    expect((next.content[0] as { text: string }).text).toBe("Hello!");
  });
});

describe("the JSON tab's unapplied text", () => {
  it("is reported to the host, so a save can refuse before it loses the typing", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    render(<TemplateEditor value={template} onChange={vi.fn()} onPendingChange={onPendingChange} />);

    await user.click(screen.getByRole("tab", { name: /JSON/ }));
    expect(onPendingChange).toHaveBeenLastCalledWith(false);

    const source = screen.getByRole("textbox");
    await user.type(source, " ");

    expect(onPendingChange).toHaveBeenLastCalledWith(true);
  });

  it("stops being pending once it is applied", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    const onChange = vi.fn();
    render(<TemplateEditor value={template} onChange={onChange} onPendingChange={onPendingChange} />);

    await user.click(screen.getByRole("tab", { name: /JSON/ }));
    const source = screen.getByRole("textbox");
    await user.clear(source);
    // Pasted rather than typed: braces are keyboard modifiers to user-event.
    await user.click(source);
    await user.paste(JSON.stringify({ version: "1.0.0", content: [] }));
    await user.click(screen.getByRole("button", { name: "Apply JSON" }));

    expect(onChange).toHaveBeenCalled();
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
  });

  it("stops being pending when the tab is left, because the text goes with it", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    render(<TemplateEditor value={template} onChange={vi.fn()} onPendingChange={onPendingChange} />);

    await user.click(screen.getByRole("tab", { name: /JSON/ }));
    await user.type(screen.getByRole("textbox"), " ");
    expect(onPendingChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole("tab", { name: /Metadata/ }));

    // Otherwise the host refuses to save on account of text that is gone, and
    // the controls it would name are unmounted.
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
  });

  it("does not report on every render, so a host may hold it in state", async () => {
    const user = userEvent.setup();
    const calls: boolean[] = [];

    function Host(): JSX.Element {
      return (
        <TemplateEditor
          value={template}
          onChange={vi.fn()}
          // An inline function: a new identity on every render, which is what
          // a host writes without thinking about it.
          onPendingChange={(pending) => calls.push(pending)}
        />
      );
    }

    render(<Host />);
    await user.click(screen.getByRole("tab", { name: /JSON/ }));
    const beforeTyping = calls.length;
    await user.type(screen.getByRole("textbox"), "  ");

    // Two keystrokes past the first, which is the only one that changes the
    // pending state. A report per render would be many more than that.
    expect(calls.length - beforeTyping).toBeLessThanOrEqual(2);
    expect(calls[calls.length - 1]).toBe(true);
  });

  it("is not reported when the host renders its own JSON tab", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    render(
      <TemplateEditor
        value={template}
        onChange={vi.fn()}
        showJsonTab={false}
        onPendingChange={onPendingChange}
      />,
    );

    const tabs = screen.getByRole("tablist");
    expect(within(tabs).queryByRole("tab", { name: /JSON/ })).toBeNull();

    await user.click(screen.getByRole("tab", { name: /Metadata/ }));
    expect(onPendingChange).not.toHaveBeenCalled();
  });
});
