import { useCallback, useMemo, useState } from "react";
import { BlockList } from "./components/BlockList";
import { CustomTypesPanel } from "./components/CustomTypesPanel";
import { JsonView } from "./components/JsonView";
import { MetadataPanel } from "./components/MetadataPanel";
import { VariablesPanel } from "./components/VariablesPanel";
import { EditorContextProvider } from "./context";
import type { ItsTemplate, TemplateEditorProps } from "./types";
import { collectVariableReferences, resolveInstructionTypes } from "./utils";

type EditorTab = "content" | "variables" | "types" | "metadata" | "json";

export function TemplateEditor({
  value,
  onChange,
  instructionTypes = {},
  schemaOptions = [],
  showJsonTab = true,
  readOnly = false,
  onPendingChange,
  className,
}: TemplateEditorProps): JSX.Element {
  const [tab, setTab] = useState<EditorTab>("content");

  /*
   * Read-only is enforced twice on purpose. The disabled fieldset below stops
   * every control in the body, including any added to a panel later, and this
   * stops anything that changes the template without going through a form
   * control: a keyboard shortcut, a drop target, an effect. Either alone would
   * be a rule that some future panel could be written around.
   */
  const handleChange = useCallback(
    (next: ItsTemplate): void => {
      if (readOnly) return;
      onChange(next);
    },
    [onChange, readOnly],
  );

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
    <EditorContextProvider value={{ instructionTypes: mergedTypes, variables: value.variables ?? {}, readOnly }}>
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

        {/*
          * A disabled fieldset disables every form control inside it, which is
          * the whole editing surface in one declaration rather than a readOnly
          * prop threaded through thirteen panels and remembered in the next
          * one. The tab strip stays outside it: reading a template means
          * moving between its tabs.
          */}
        <fieldset className="its-editor__body" disabled={readOnly}>
          {tab === "content" && (
            <BlockList elements={value.content} onChange={(content) => handleChange({ ...value, content })} />
          )}
          {tab === "variables" && (
            <VariablesPanel
              variables={value.variables ?? {}}
              referencedNames={referencedNames}
              onChange={(variables) =>
                handleChange({ ...value, variables: Object.keys(variables).length > 0 ? variables : undefined })
              }
            />
          )}
          {tab === "types" && (
            <CustomTypesPanel template={value} onChange={handleChange} paletteTypes={instructionTypes} />
          )}
          {tab === "metadata" && (
            <MetadataPanel template={value} onChange={handleChange} schemaOptions={schemaOptions} />
          )}
          {tab === "json" && showJsonTab && (
            <JsonView template={value} onChange={handleChange} onPendingChange={onPendingChange} />
          )}
        </fieldset>
      </div>
    </EditorContextProvider>
  );
}
