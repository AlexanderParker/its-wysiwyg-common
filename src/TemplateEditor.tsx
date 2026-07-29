import { useMemo, useState } from "react";
import { BlockList } from "./components/BlockList";
import { CustomTypesPanel } from "./components/CustomTypesPanel";
import { JsonView } from "./components/JsonView";
import { MetadataPanel } from "./components/MetadataPanel";
import { VariablesPanel } from "./components/VariablesPanel";
import { EditorContextProvider } from "./context";
import type { TemplateEditorProps } from "./types";
import { collectVariableReferences, resolveInstructionTypes } from "./utils";

type EditorTab = "content" | "variables" | "types" | "metadata" | "json";

export function TemplateEditor({
  value,
  onChange,
  instructionTypes = {},
  showJsonTab = true,
  className,
}: TemplateEditorProps): JSX.Element {
  const [tab, setTab] = useState<EditorTab>("content");

  const mergedTypes = useMemo(
    () => resolveInstructionTypes(value, instructionTypes),
    [value, instructionTypes],
  );

  const referencedNames = useMemo(() => collectVariableReferences(value.content), [value.content]);

  const tabs: Array<{ id: EditorTab; label: string; badge?: number }> = [
    { id: "content", label: "Content", badge: value.content.length },
    { id: "variables", label: "Variables", badge: Object.keys(value.variables ?? {}).length },
    { id: "types", label: "Custom types", badge: Object.keys(value.customInstructionTypes ?? {}).length },
    { id: "metadata", label: "Metadata" },
  ];
  if (showJsonTab) tabs.push({ id: "json", label: "JSON" });

  return (
    <EditorContextProvider value={{ instructionTypes: mergedTypes }}>
      <div className={className ? `its-editor ${className}` : "its-editor"}>
        <nav className="its-tabs" role="tablist">
          {tabs.map(({ id, label, badge }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "its-tab its-tab--active" : "its-tab"}
              onClick={() => setTab(id)}
            >
              {label}
              {badge !== undefined && badge > 0 && <span className="its-tab__badge">{badge}</span>}
            </button>
          ))}
        </nav>

        <div className="its-editor__body">
          {tab === "content" && (
            <BlockList elements={value.content} onChange={(content) => onChange({ ...value, content })} />
          )}
          {tab === "variables" && (
            <VariablesPanel
              variables={value.variables ?? {}}
              referencedNames={referencedNames}
              onChange={(variables) =>
                onChange({ ...value, variables: Object.keys(variables).length > 0 ? variables : undefined })
              }
            />
          )}
          {tab === "types" && (
            <CustomTypesPanel template={value} onChange={onChange} paletteTypes={instructionTypes} />
          )}
          {tab === "metadata" && <MetadataPanel template={value} onChange={onChange} />}
          {tab === "json" && showJsonTab && <JsonView template={value} onChange={onChange} />}
        </div>
      </div>
    </EditorContextProvider>
  );
}
