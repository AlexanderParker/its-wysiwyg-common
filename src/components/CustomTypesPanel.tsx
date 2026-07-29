import { useState } from "react";
import type {
  ConfigPropertySchema,
  InstructionTypeDefinition,
  ItsTemplate,
  JsonValue,
} from "../types";
import { coercePropertyValue, renameInstructionTypeReferences } from "../utils";

interface CustomTypesPanelProps {
  template: ItsTemplate;
  onChange: (template: ItsTemplate) => void;
  /** Types provided by the host (e.g. standard types), used to flag overrides. */
  paletteTypes: Record<string, InstructionTypeDefinition>;
}

const NEW_TYPE_TEMPLATE =
  "<<Replace this placeholder using this user prompt: ([{<{description}>}]).>>";

export function CustomTypesPanel({ template, onChange, paletteTypes }: CustomTypesPanelProps): JSX.Element {
  const [newName, setNewName] = useState("");
  const customTypes = template.customInstructionTypes ?? {};
  const names = Object.keys(customTypes);

  const setTypes = (types: Record<string, InstructionTypeDefinition>): void => {
    onChange({
      ...template,
      customInstructionTypes: Object.keys(types).length > 0 ? types : undefined,
    });
  };

  const setType = (name: string, definition: InstructionTypeDefinition): void => {
    setTypes({ ...customTypes, [name]: definition });
  };

  const rename = (oldName: string, name: string): void => {
    if (name === oldName || name === "") return;
    const next: Record<string, InstructionTypeDefinition> = {};
    for (const key of names) {
      next[key === oldName ? name : key] = customTypes[key];
    }
    onChange({
      ...template,
      customInstructionTypes: next,
      content: renameInstructionTypeReferences(template.content, oldName, name),
    });
  };

  const remove = (name: string): void => {
    const next = { ...customTypes };
    delete next[name];
    setTypes(next);
  };

  const addType = (): void => {
    const name = newName.trim();
    if (name === "" || name in customTypes) return;
    setType(name, {
      template: NEW_TYPE_TEMPLATE,
      description: "",
      configSchema: { type: "object", properties: {} },
    });
    setNewName("");
  };

  return (
    <div className="its-customtypes">
      <p className="its-hint">
        Custom instruction types belong to this template and take precedence over any types with the same name from
        extended schemas. The <code>template</code> string is what the placeholder compiles to;{" "}
        <code>{"{description}"}</code> and <code>{"{propertyName}"}</code> are substituted from each placeholder's
        config.
      </p>

      {names.length === 0 && <p className="its-blocklist__empty">No custom instruction types defined.</p>}

      {names.map((name) => (
        <TypeCard
          key={name}
          name={name}
          definition={customTypes[name]}
          overridesPalette={name in paletteTypes}
          onRename={(next) => rename(name, next)}
          onChange={(definition) => setType(name, definition)}
          onDelete={() => remove(name)}
        />
      ))}

      <div className="its-varadd">
        <input
          type="text"
          placeholder="New type name, e.g. call_to_action"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addType();
          }}
        />
        <button type="button" onClick={addType} disabled={newName.trim() === "" || newName.trim() in customTypes}>
          Add type
        </button>
      </div>
    </div>
  );
}

interface TypeCardProps {
  name: string;
  definition: InstructionTypeDefinition;
  overridesPalette: boolean;
  onRename: (name: string) => void;
  onChange: (definition: InstructionTypeDefinition) => void;
  onDelete: () => void;
}

function TypeCard({ name, definition, overridesPalette, onRename, onChange, onDelete }: TypeCardProps): JSX.Element {
  const [draftName, setDraftName] = useState(name);
  const properties = definition.configSchema?.properties ?? {};
  const propertyNames = Object.keys(properties);
  const templateText = definition.template ?? "";
  const missingChevrons = templateText !== "" && (!templateText.includes("<<") || !templateText.includes(">>"));

  const commitName = (): void => {
    const trimmed = draftName.trim();
    if (trimmed === "" || trimmed === name) {
      setDraftName(name);
      return;
    }
    onRename(trimmed);
  };

  const setProperties = (next: Record<string, ConfigPropertySchema>): void => {
    onChange({
      ...definition,
      configSchema: { type: "object", properties: next },
    });
  };

  const setProperty = (propertyName: string, schema: ConfigPropertySchema): void => {
    setProperties({ ...properties, [propertyName]: schema });
  };

  const renameProperty = (oldName: string, nextName: string): void => {
    if (nextName === oldName || nextName === "") return;
    const next: Record<string, ConfigPropertySchema> = {};
    for (const key of propertyNames) {
      next[key === oldName ? nextName : key] = properties[key];
    }
    setProperties(next);
  };

  const removeProperty = (propertyName: string): void => {
    const next = { ...properties };
    delete next[propertyName];
    setProperties(next);
  };

  const addProperty = (): void => {
    let candidate = "option";
    let counter = 1;
    while (candidate in properties) {
      counter += 1;
      candidate = `option${counter}`;
    }
    setProperty(candidate, { type: "string" });
  };

  return (
    <div className="its-typecard">
      <div className="its-typecard__head">
        <input
          className="its-varrow__name"
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
          aria-label="Type name"
        />
        {overridesPalette && (
          <span className="its-varrow__unused" title="A type with this name also exists in an extended schema; this definition wins">
            overrides
          </span>
        )}
        <button type="button" className="its-varrow__delete" onClick={onDelete} aria-label={`Delete ${name}`}>
          ✕
        </button>
      </div>

      <label className="its-field its-field--wide">
        <span className="its-field__name">description</span>
        <input
          type="text"
          value={definition.description ?? ""}
          placeholder="What this instruction type generates"
          onChange={(event) => onChange({ ...definition, description: event.target.value })}
        />
      </label>

      <label className="its-field its-field--wide">
        <span className="its-field__name">template</span>
        <textarea
          className="its-mono"
          rows={3}
          value={templateText}
          onChange={(event) => onChange({ ...definition, template: event.target.value })}
        />
      </label>
      {missingChevrons && (
        <p className="its-typecard__note">
          Compiled placeholders are normally wrapped in {"<<"} and {">>"} so the receiving AI can find them.
        </p>
      )}

      <div className="its-typecard__props">
        <span className="its-field__name">config properties</span>
        {propertyNames.length === 0 && (
          <p className="its-hint">No properties besides the standard description field.</p>
        )}
        {propertyNames.map((propertyName) => (
          <PropertyRow
            key={propertyName}
            name={propertyName}
            schema={properties[propertyName]}
            onRename={(next) => renameProperty(propertyName, next)}
            onChange={(schema) => setProperty(propertyName, schema)}
            onDelete={() => removeProperty(propertyName)}
          />
        ))}
        <button type="button" className="its-branch__toggle" onClick={addProperty}>
          Add property
        </button>
      </div>
    </div>
  );
}

interface PropertyRowProps {
  name: string;
  schema: ConfigPropertySchema;
  onRename: (name: string) => void;
  onChange: (schema: ConfigPropertySchema) => void;
  onDelete: () => void;
}

function PropertyRow({ name, schema, onRename, onChange, onDelete }: PropertyRowProps): JSX.Element {
  const [draftName, setDraftName] = useState(name);
  const propertyType = schema.type ?? "string";

  const commitName = (): void => {
    const trimmed = draftName.trim();
    if (trimmed === "" || trimmed === name) {
      setDraftName(name);
      return;
    }
    onRename(trimmed);
  };

  const setSchemaField = <K extends keyof ConfigPropertySchema>(key: K, value: ConfigPropertySchema[K] | undefined): void => {
    const next = { ...schema };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  const setEnum = (raw: string): void => {
    const values = raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "");
    if (values.length === 0) {
      setSchemaField("enum", undefined);
      return;
    }
    if (propertyType === "integer" || propertyType === "number") {
      const numbers = values.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
      setSchemaField("enum", numbers);
    } else {
      setSchemaField("enum", values);
    }
  };

  const setDefault = (raw: string): void => {
    if (raw === "") {
      setSchemaField("default", undefined);
      return;
    }
    const coerced: JsonValue =
      propertyType === "boolean" ? raw === "true" : coercePropertyValue(schema, raw);
    setSchemaField("default", coerced);
  };

  return (
    <div className="its-proprow">
      <input
        className="its-proprow__name its-mono"
        type="text"
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        aria-label="Property name"
      />
      <select
        value={propertyType}
        onChange={(event) => {
          const nextType = event.target.value as NonNullable<ConfigPropertySchema["type"]>;
          onChange({ type: nextType });
        }}
        aria-label="Property type"
      >
        <option value="string">string</option>
        <option value="integer">integer</option>
        <option value="number">number</option>
        <option value="boolean">boolean</option>
      </select>
      {propertyType === "boolean" ? (
        <select
          className="its-proprow__booldefault"
          value={schema.default === undefined ? "" : String(schema.default)}
          onChange={(event) => setDefault(event.target.value)}
          aria-label="Default value"
        >
          <option value="">no default</option>
          <option value="true">default: true</option>
          <option value="false">default: false</option>
        </select>
      ) : (
        <>
          <input
            type="text"
            className="its-proprow__enum its-mono"
            placeholder="enum values, comma separated"
            value={(schema.enum ?? []).join(", ")}
            onChange={(event) => setEnum(event.target.value)}
            aria-label="Enum values"
          />
          <input
            type="text"
            className="its-proprow__default its-mono"
            placeholder="default"
            value={schema.default === undefined || schema.default === null ? "" : String(schema.default)}
            onChange={(event) => setDefault(event.target.value)}
            aria-label="Default value"
          />
        </>
      )}
      <button type="button" className="its-varrow__delete" onClick={onDelete} aria-label={`Delete property ${name}`}>
        ✕
      </button>
    </div>
  );
}
