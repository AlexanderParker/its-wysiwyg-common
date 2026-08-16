import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { TemplateEditor } from "its-template-editor";
import type { InstructionTypeDefinition, ItsTemplate } from "its-template-editor";
import "its-template-editor/styles.css";

/**
 * A small static palette so the playground works offline. Host applications
 * normally fetch the published type libraries and pass them in; the editor
 * itself never fetches.
 */
const paletteTypes: Record<string, InstructionTypeDefinition> = {
  title: {
    template:
      "<<Replace this placeholder with a title using this user prompt: ([{<{description}>}]). Format requirements: Create a {style} title that is {length} in length.>>",
    description: "Generates titles and headlines with customizable style and length",
    configSchema: {
      type: "object",
      properties: {
        style: { type: "string", enum: ["headline", "descriptive", "catchy", "formal", "creative"], default: "headline" },
        length: { type: "string", enum: ["short", "medium", "long"], default: "short" },
      },
    },
  },
  paragraph: {
    template:
      "<<Replace this placeholder with text using this user prompt: ([{<{description}>}]). Format requirements: Use {tone} tone and {length} length (short=1-2 sentences, medium=2-4 sentences, long=4+ sentences).>>",
    description: "Generates paragraphs of text with customizable tone and length",
    configSchema: {
      type: "object",
      properties: {
        tone: { type: "string", enum: ["formal", "casual", "enthusiastic", "professional", "friendly"], default: "professional" },
        length: { type: "string", enum: ["short", "medium", "long"], default: "medium" },
      },
    },
  },
  list: {
    template:
      "<<Replace this placeholder with a list using this user prompt: ([{<{description}>}]). Format requirements: Use {format} formatting with each item on a new line.>>",
    description: "Generates formatted lists with customizable formatting and optional item counts",
    configSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["bullet_points", "numbered", "dashes", "plain"], default: "bullet_points" },
        itemCount: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
};

const initialTemplate: ItsTemplate = {
  $schema: "https://alexanderparker.github.io/instruction-template-specification/schema/v1.0/its-base-schema-v1.json",
  version: "1.0.0",
  metadata: {
    name: "Playground template",
    description: "A scratch template for developing the editor in isolation.",
  },
  variables: {
    topic: "renewable energy",
    includeSummary: true,
  },
  content: [
    { type: "text", text: "# ", id: "t-hash" },
    {
      type: "placeholder",
      id: "p-title",
      instructionType: "title",
      config: { description: "A title about ${topic}", displayName: "Title", style: "headline", length: "short" },
    },
    {
      type: "conditional",
      id: "c-summary",
      condition: "includeSummary == true",
      content: [
        { type: "text", text: "\n\n", id: "t-gap" },
        {
          type: "placeholder",
          id: "p-summary",
          instructionType: "paragraph",
          config: { description: "Summarise ${topic}", displayName: "Summary", tone: "professional", length: "short" },
        },
      ],
    },
  ],
};

function Playground(): JSX.Element {
  const [template, setTemplate] = useState<ItsTemplate>(initialTemplate);
  const [readOnly, setReadOnly] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <div style={{ maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>its-template-editor playground</h1>
      <p>
        <label>
          <input type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} /> Read
          only
        </label>{" "}
        {pending && <strong>The JSON tab is holding unapplied text.</strong>}
      </p>
      <TemplateEditor
        value={template}
        onChange={setTemplate}
        instructionTypes={paletteTypes}
        readOnly={readOnly}
        onPendingChange={setPending}
      />
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
