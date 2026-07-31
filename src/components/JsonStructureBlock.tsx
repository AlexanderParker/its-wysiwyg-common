import { useState } from "react";
import type { JsonArrayEntry, JsonObjectEntry, JsonStructure, JsonStructureValue } from "../jsonStructure";
import type { JsonValue } from "../types";
import { removeAt, replaceAt } from "../utils";
import { BlockFrame } from "./BlockFrame";
import { VariableField } from "./VariableField";

interface JsonStructureBlockProps {
  structure: JsonStructure;
  onChange: (structure: JsonStructure) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const VALUE_KINDS = [
  { id: "generated-string", label: "Generated string" },
  { id: "generated-number", label: "Generated number" },
  { id: "generated-value", label: "Generated value" },
  { id: "object", label: "Object" },
  { id: "array", label: "Array" },
  { id: "literal-string", label: "Fixed string" },
  { id: "literal-number", label: "Fixed number" },
  { id: "literal-boolean", label: "Fixed true/false" },
  { id: "literal-null", label: "Fixed null" },
] as const;

type ValueKindId = (typeof VALUE_KINDS)[number]["id"];

function valueKindOf(value: JsonStructureValue): ValueKindId {
  if (value.kind === "literal") {
    if (typeof value.value === "number") return "literal-number";
    if (typeof value.value === "boolean") return "literal-boolean";
    if (value.value === null) return "literal-null";
    return "literal-string";
  }
  if (value.kind === "object") return "object";
  if (value.kind === "array") return "array";
  if (value.type === "json_string") return "generated-string";
  if (value.type === "json_number") return "generated-number";
  return "generated-value";
}

function convertValue(value: JsonStructureValue, kind: ValueKindId): JsonStructureValue {
  if (valueKindOf(value) === kind) return value;
  const description = value.kind === "generated" ? value.description : "";
  const literal = value.kind === "literal" ? value.value : undefined;
  switch (kind) {
    case "generated-string":
      return { kind: "generated", type: "json_string", description };
    case "generated-number":
      return { kind: "generated", type: "json_number", description, numberType: "any" };
    case "generated-value":
      return { kind: "generated", type: "json_value", description, valueType: "any" };
    case "object":
      return { kind: "object", entries: [] };
    case "array":
      return { kind: "array", entries: [] };
    case "literal-string":
      return { kind: "literal", value: typeof literal === "number" || typeof literal === "boolean" ? String(literal) : "" };
    case "literal-number": {
      const parsed = typeof literal === "string" ? Number.parseFloat(literal) : NaN;
      return { kind: "literal", value: Number.isNaN(parsed) ? 0 : parsed };
    }
    case "literal-boolean":
      return { kind: "literal", value: true };
    case "literal-null":
      return { kind: "literal", value: null };
  }
}

export function JsonStructureBlock(props: JsonStructureBlockProps): JSX.Element {
  const { structure, onChange } = props;

  const switchRoot = (kind: "object" | "array"): void => {
    if (structure.kind === kind) return;
    if (kind === "array") {
      const entries: JsonArrayEntry[] = (structure.entries as JsonObjectEntry[]).map((entry) =>
        entry.kind === "property"
          ? { kind: "item", value: entry.value }
          : { kind: "generatedItems", description: entry.description, itemType: "object" },
      );
      onChange({ kind: "array", entries });
    } else {
      const entries: JsonObjectEntry[] = (structure.entries as JsonArrayEntry[]).map((entry, index) =>
        entry.kind === "item"
          ? { kind: "property", name: `field${index + 1}`, value: entry.value }
          : { kind: "generatedFields", description: entry.description },
      );
      onChange({ kind: "object", entries });
    }
  };

  return (
    <BlockFrame
      kind="json"
      label={
        <>
          <span>JSON structure</span>
          <select
            className="its-block__typeselect"
            value={structure.kind}
            onChange={(event) => switchRoot(event.target.value as "object" | "array")}
          >
            <option value="object">object</option>
            <option value="array">array</option>
          </select>
        </>
      }
      onMoveUp={props.onMoveUp}
      onMoveDown={props.onMoveDown}
      onDuplicate={props.onDuplicate}
      onDelete={props.onDelete}
      canMoveUp={props.canMoveUp}
      canMoveDown={props.canMoveDown}
    >
      <p className="its-json__hint">
        The fixed shape below is emitted verbatim; generated positions become instructions. A template containing only
        this block compiles to a prompt whose one-shot response is the completed raw JSON document.
      </p>
      {structure.kind === "object" ? (
        <ObjectEditor entries={structure.entries} onChange={(entries) => onChange({ kind: "object", entries })} />
      ) : (
        <ArrayEditor entries={structure.entries} onChange={(entries) => onChange({ kind: "array", entries })} />
      )}
    </BlockFrame>
  );
}

function ObjectEditor({
  entries,
  onChange,
}: {
  entries: JsonObjectEntry[];
  onChange: (entries: JsonObjectEntry[]) => void;
}): JSX.Element {
  return (
    <div className="its-json__container">
      <span className="its-json__bracket">{"{"}</span>
      {entries.map((entry, index) => (
        <div className="its-json__entry" key={index}>
          {entry.kind === "property" ? (
            <PropertyEditor
              entry={entry}
              onChange={(updated) => onChange(replaceAt(entries, index, updated))}
              onRemove={() => onChange(removeAt(entries, index))}
            />
          ) : (
            <GeneratedEntryEditor
              label="generated fields"
              description={entry.description}
              count={entry.fieldCount}
              countLabel="fields"
              onDescription={(description) => onChange(replaceAt(entries, index, { ...entry, description }))}
              onCount={(fieldCount) =>
                onChange(
                  replaceAt(
                    entries,
                    index,
                    fieldCount === undefined ? { kind: "generatedFields", description: entry.description } : { ...entry, fieldCount },
                  ),
                )
              }
              onRemove={() => onChange(removeAt(entries, index))}
            />
          )}
        </div>
      ))}
      <span className="its-json__bracket">{"}"}</span>
      <div className="its-json__adders">
        <button
          type="button"
          onClick={() =>
            onChange([...entries, { kind: "property", name: `field${entries.length + 1}`, value: { kind: "generated", type: "json_string", description: "" } }])
          }
        >
          + property
        </button>
        <button type="button" onClick={() => onChange([...entries, { kind: "generatedFields", description: "" }])}>
          + generated fields
        </button>
      </div>
    </div>
  );
}

function ArrayEditor({
  entries,
  onChange,
}: {
  entries: JsonArrayEntry[];
  onChange: (entries: JsonArrayEntry[]) => void;
}): JSX.Element {
  return (
    <div className="its-json__container">
      <span className="its-json__bracket">[</span>
      {entries.map((entry, index) => (
        <div className="its-json__entry" key={index}>
          {entry.kind === "item" ? (
            <div className="its-json__row">
              <ValueEditor value={entry.value} onChange={(value) => onChange(replaceAt(entries, index, { kind: "item", value }))} />
              <RemoveButton onClick={() => onChange(removeAt(entries, index))} />
            </div>
          ) : (
            <GeneratedEntryEditor
              label="generated items"
              description={entry.description}
              count={entry.itemCount}
              countLabel="items"
              itemType={entry.itemType ?? "any"}
              onItemType={(itemType) => onChange(replaceAt(entries, index, { ...entry, itemType }))}
              onDescription={(description) => onChange(replaceAt(entries, index, { ...entry, description }))}
              onCount={(itemCount) =>
                onChange(
                  replaceAt(
                    entries,
                    index,
                    itemCount === undefined
                      ? { kind: "generatedItems", description: entry.description, itemType: entry.itemType }
                      : { ...entry, itemCount },
                  ),
                )
              }
              onRemove={() => onChange(removeAt(entries, index))}
            />
          )}
        </div>
      ))}
      <span className="its-json__bracket">]</span>
      <div className="its-json__adders">
        <button
          type="button"
          onClick={() => onChange([...entries, { kind: "item", value: { kind: "generated", type: "json_string", description: "" } }])}
        >
          + item
        </button>
        <button type="button" onClick={() => onChange([...entries, { kind: "generatedItems", description: "", itemType: "any" }])}>
          + generated items
        </button>
      </div>
    </div>
  );
}

function PropertyEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: Extract<JsonObjectEntry, { kind: "property" }>;
  onChange: (entry: JsonObjectEntry) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div className="its-json__row">
      <input
        className="its-json__name"
        type="text"
        value={entry.name}
        spellCheck={false}
        aria-label="Property name"
        onChange={(event) => onChange({ ...entry, name: event.target.value })}
      />
      <span className="its-json__colon">:</span>
      <ValueEditor value={entry.value} onChange={(value) => onChange({ ...entry, value })} />
      <RemoveButton onClick={onRemove} />
    </div>
  );
}

function ValueEditor({
  value,
  onChange,
}: {
  value: JsonStructureValue;
  onChange: (value: JsonStructureValue) => void;
}): JSX.Element {
  const kind = valueKindOf(value);
  return (
    <div className="its-json__value">
      <div className="its-json__valuehead">
        <select
          className="its-json__kind"
          value={kind}
          aria-label="Value kind"
          onChange={(event) => onChange(convertValue(value, event.target.value as ValueKindId))}
        >
          {VALUE_KINDS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {value.kind === "generated" && (
          <>
            <VariableField
              as="input"
              className="its-json__description"
              value={value.description}
              placeholder="What should be generated here?"
              onValueChange={(description) => onChange({ ...value, description })}
            />
            {value.type === "json_number" && (
              <select
                className="its-json__opt"
                value={value.numberType ?? "any"}
                aria-label="Number kind"
                onChange={(event) => onChange({ ...value, numberType: event.target.value })}
              >
                <option value="any">any</option>
                <option value="integer">integer</option>
                <option value="decimal">decimal</option>
              </select>
            )}
            {value.type === "json_value" && (
              <select
                className="its-json__opt"
                value={value.valueType ?? "any"}
                aria-label="Value type"
                onChange={(event) => onChange({ ...value, valueType: event.target.value })}
              >
                {["any", "string", "number", "boolean", "array", "object"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        {value.kind === "literal" && (
          <LiteralEditor value={value.value} onChange={(literal) => onChange({ kind: "literal", value: literal })} />
        )}
      </div>
      {value.kind === "object" && (
        <ObjectEditor entries={value.entries} onChange={(entries) => onChange({ kind: "object", entries })} />
      )}
      {value.kind === "array" && (
        <ArrayEditor entries={value.entries} onChange={(entries) => onChange({ kind: "array", entries })} />
      )}
    </div>
  );
}

function LiteralEditor({ value, onChange }: { value: JsonValue; onChange: (value: JsonValue) => void }): JSX.Element {
  if (value === null) {
    return <span className="its-json__nullchip" title="Emitted as a JSON null">null</span>;
  }
  if (typeof value === "number") {
    return <FixedNumberEditor value={value} onChange={onChange} />;
  }
  if (typeof value === "boolean") {
    return (
      <select
        className="its-json__opt"
        value={value ? "true" : "false"}
        aria-label="Fixed boolean value"
        onChange={(event) => onChange(event.target.value === "true")}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  // Fixed strings are typed without quotes; the builder adds them when the
  // JSON is emitted. Right-click inserts a ${variable} reference.
  return (
    <VariableField
      as="input"
      className="its-json__literal"
      spellCheck={false}
      ariaLabel="Fixed string value"
      title="A fixed string, emitted as a quoted JSON string. No quotes needed; supports ${variables}."
      value={typeof value === "string" ? value : ""}
      onValueChange={onChange}
    />
  );
}

function FixedNumberEditor({ value, onChange }: { value: number; onChange: (value: JsonValue) => void }): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && Number.isNaN(Number.parseFloat(draft));

  return (
    <input
      className={invalid ? "its-json__literal its-json__literal--invalid" : "its-json__literal"}
      type="number"
      step="any"
      aria-label="Fixed number value"
      title="A fixed number, emitted without quotes"
      value={draft ?? String(value)}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = Number.parseFloat(event.target.value);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function GeneratedEntryEditor(props: {
  label: string;
  description: string;
  count?: number;
  countLabel: string;
  itemType?: string;
  onItemType?: (itemType: string) => void;
  onDescription: (description: string) => void;
  onCount: (count: number | undefined) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div className="its-json__row its-json__row--generated">
      <span className="its-json__genlabel">{props.label}</span>
      <VariableField
        as="input"
        className="its-json__description"
        value={props.description}
        placeholder="What should be generated here?"
        onValueChange={props.onDescription}
      />
      {props.itemType !== undefined && props.onItemType && (
        <select className="its-json__opt" value={props.itemType} aria-label="Item type" onChange={(event) => props.onItemType?.(event.target.value)}>
          {["any", "string", "number", "boolean", "object", "array"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
      <input
        className="its-json__count"
        type="number"
        min={1}
        value={props.count ?? ""}
        placeholder={props.countLabel}
        aria-label={`Number of ${props.countLabel}`}
        onChange={(event) => {
          const parsed = parseInt(event.target.value, 10);
          props.onCount(Number.isNaN(parsed) ? undefined : parsed);
        }}
      />
      <RemoveButton onClick={props.onRemove} />
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="its-json__remove" title="Remove" aria-label="Remove entry" onClick={onClick}>
      ✕
    </button>
  );
}
