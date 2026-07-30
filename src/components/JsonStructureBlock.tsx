import { useState } from "react";
import type { JsonArrayEntry, JsonObjectEntry, JsonStructure, JsonStructureValue } from "../jsonStructure";
import type { JsonValue } from "../types";
import { removeAt, replaceAt } from "../utils";
import { BlockFrame } from "./BlockFrame";

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
  { id: "literal", label: "Fixed value" },
] as const;

type ValueKindId = (typeof VALUE_KINDS)[number]["id"];

function valueKindOf(value: JsonStructureValue): ValueKindId {
  if (value.kind === "literal") return "literal";
  if (value.kind === "object") return "object";
  if (value.kind === "array") return "array";
  if (value.type === "json_string") return "generated-string";
  if (value.type === "json_number") return "generated-number";
  return "generated-value";
}

function convertValue(value: JsonStructureValue, kind: ValueKindId): JsonStructureValue {
  if (valueKindOf(value) === kind) return value;
  const description = value.kind === "generated" ? value.description : "";
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
    case "literal":
      return { kind: "literal", value: "" };
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
            <input
              className="its-json__description"
              type="text"
              value={value.description}
              placeholder="What should be generated here?"
              onChange={(event) => onChange({ ...value, description: event.target.value })}
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
        {value.kind === "literal" && <LiteralEditor value={value.value} onChange={(literal) => onChange({ kind: "literal", value: literal })} />}
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
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const commit = (raw: string): void => {
    try {
      onChange(JSON.parse(raw) as JsonValue);
      setInvalid(false);
      setDraft(null);
    } catch {
      // Bare text is treated as a string so fixed values need no quoting
      if (!/^[\s{["]|^-?[0-9]|^(true|false|null)$/.test(raw.trim()) && raw.trim() !== "") {
        onChange(raw);
        setInvalid(false);
        setDraft(null);
      } else {
        setInvalid(true);
      }
    }
  };

  return (
    <input
      className={invalid ? "its-json__literal its-json__literal--invalid" : "its-json__literal"}
      type="text"
      spellCheck={false}
      aria-label="Fixed JSON value"
      title='A fixed JSON value, emitted verbatim. Unquoted text is kept as a string; use JSON syntax for numbers, booleans, arrays and objects.'
      value={draft ?? JSON.stringify(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        if (draft !== null) commit(event.target.value);
      }}
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
      <input
        className="its-json__description"
        type="text"
        value={props.description}
        placeholder="What should be generated here?"
        onChange={(event) => props.onDescription(event.target.value)}
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
