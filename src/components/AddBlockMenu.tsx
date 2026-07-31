import { useState } from "react";
import { useEditorContext } from "../context";
import { JSON_STRUCTURE_TYPES, emptyJsonStructure, serialiseJsonStructure } from "../jsonStructure";
import type { ContentElement } from "../types";
import { defaultConfigFor, nextElementId } from "../utils";

interface AddBlockMenuProps {
  onAdd: (element: ContentElement) => void;
  onAddGroup?: (elements: ContentElement[]) => void;
  compact?: boolean;
}

export function AddBlockMenu({ onAdd, onAddGroup, compact = false }: AddBlockMenuProps): JSX.Element {
  const { instructionTypes } = useEditorContext();
  const [open, setOpen] = useState(false);

  // The builder serialises to JSON type placeholders, so it is only offered
  // when the template's palette provides those types
  const jsonStructureAvailable = JSON_STRUCTURE_TYPES.every((name) => name in instructionTypes);

  const add = (element: ContentElement): void => {
    onAdd(element);
    setOpen(false);
  };

  const addText = (): void =>
    add({ type: "text", text: "", id: nextElementId("text") });

  // A line break is a text element holding a literal newline: it appears
  // verbatim in the compiled template rather than being generated
  const addLineBreak = (): void =>
    add({ type: "text", text: "\n", id: nextElementId("text") });

  const addConditional = (): void =>
    add({
      type: "conditional",
      condition: "",
      content: [{ type: "text", text: "", id: nextElementId("text") }],
      id: nextElementId("conditional"),
    });

  const addJsonStructure = (): void => {
    onAddGroup?.(serialiseJsonStructure(emptyJsonStructure()));
    setOpen(false);
  };

  const addPlaceholder = (typeName: string): void =>
    add({
      type: "placeholder",
      instructionType: typeName,
      config: defaultConfigFor(instructionTypes[typeName]),
      id: nextElementId("placeholder"),
    });

  if (!open) {
    return (
      <div className={compact ? "its-add its-add--compact" : "its-add"}>
        <button type="button" className="its-add__trigger" onClick={() => setOpen(true)}>
          + Add block
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? "its-add its-add--compact its-add--open" : "its-add its-add--open"}>
      <div className="its-add__panel" role="menu">
        <div className="its-add__group">
          <span className="its-add__label">Structure</span>
          <button type="button" onClick={addText}>Text</button>
          <button type="button" title="Ends the current line in the compiled template" onClick={addLineBreak}>
            Line break
          </button>
          <button type="button" onClick={addConditional}>Conditional</button>
          {onAddGroup && jsonStructureAvailable && (
            <button type="button" title="Interactively build a JSON document with generated value positions" onClick={addJsonStructure}>
              JSON structure
            </button>
          )}
        </div>
        <div className="its-add__group">
          <span className="its-add__label">Placeholders</span>
          {Object.keys(instructionTypes).length === 0 && (
            <span className="its-add__empty">No instruction types available</span>
          )}
          {Object.entries(instructionTypes).map(([name, definition]) => (
            <button
              type="button"
              key={name}
              title={definition.description}
              onClick={() => addPlaceholder(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <button type="button" className="its-add__cancel" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
