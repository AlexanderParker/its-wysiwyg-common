import type { ConfigPropertySchema, InstructionTypeDefinition, JsonValue, PlaceholderConfig } from "../types";
import { coercePropertyValue } from "../utils";
import { VariableField } from "./VariableField";

interface ConfigFormProps {
  definition: InstructionTypeDefinition | undefined;
  config: PlaceholderConfig;
  onChange: (config: PlaceholderConfig) => void;
}

function fieldValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

export function ConfigForm({ definition, config, onChange }: ConfigFormProps): JSX.Element {
  const properties: Record<string, ConfigPropertySchema> = definition?.configSchema?.properties ?? {};

  const setField = (name: string, value: JsonValue | undefined): void => {
    const next: PlaceholderConfig = { ...config };
    if (value === undefined || value === "") {
      delete next[name];
      if (name === "description") next.description = "";
    } else {
      next[name] = value;
    }
    onChange(next);
  };

  return (
    <div className="its-config">
      <label className="its-field its-field--wide">
        <span className="its-field__name">description</span>
        <VariableField
          as="textarea"
          rows={2}
          value={config.description ?? ""}
          placeholder="What should the AI generate here? Supports ${variables}; right-click to insert one."
          onValueChange={(description) => onChange({ ...config, description })}
        />
      </label>

      <div className="its-config__grid">
        {Object.entries(properties)
          .filter(([name]) => name !== "description")
          .map(([name, schema]) => (
            <label className="its-field" key={name} title={schema.description}>
              <span className="its-field__name">{name}</span>
              {schema.enum ? (
                <select
                  value={fieldValue(config[name] as JsonValue | undefined)}
                  onChange={(event) =>
                    setField(name, event.target.value === "" ? undefined : coercePropertyValue(schema, event.target.value))
                  }
                >
                  <option value="">(unset)</option>
                  {schema.enum.map((option) => (
                    <option key={String(option)} value={String(option)}>
                      {String(option)}
                    </option>
                  ))}
                </select>
              ) : schema.type === "boolean" ? (
                <select
                  value={fieldValue(config[name] as JsonValue | undefined)}
                  onChange={(event) =>
                    setField(name, event.target.value === "" ? undefined : event.target.value === "true")
                  }
                >
                  <option value="">(unset)</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : schema.type === "integer" || schema.type === "number" ? (
                <input
                  type="number"
                  min={schema.minimum}
                  max={schema.maximum}
                  value={fieldValue(config[name] as JsonValue | undefined)}
                  onChange={(event) =>
                    setField(name, event.target.value === "" ? undefined : coercePropertyValue(schema, event.target.value))
                  }
                />
              ) : (
                <VariableField
                  as="input"
                  value={fieldValue(config[name] as JsonValue | undefined)}
                  onValueChange={(next) => setField(name, next === "" ? undefined : next)}
                />
              )}
            </label>
          ))}
      </div>

      <label className="its-field its-field--wide">
        <span className="its-field__name">displayName (optional)</span>
        <input
          type="text"
          value={config.displayName ?? ""}
          placeholder="Human-readable name for this placeholder"
          onChange={(event) => setField("displayName", event.target.value === "" ? undefined : event.target.value)}
        />
      </label>

      <label className="its-field its-field--wide" title="Variables rendered once as a REFERENCE DATA section above the template - context the model uses but never outputs">
        <span className="its-field__name">data sources (optional)</span>
        <input
          type="text"
          value={dataSourceText(config.dataSource)}
          placeholder="Variable names, comma-separated, e.g. forecast"
          spellCheck={false}
          onChange={(event) => {
            const names = event.target.value
              .split(",")
              .map((name) => name.trim())
              .filter((name) => name.length > 0);
            setField("dataSource", names.length === 0 ? undefined : names.length === 1 ? names[0] : names);
          }}
        />
      </label>

      {config.dataSource !== undefined && (
        <label
          className="its-field"
          title="Caps how many items or fields of each data source are included; when placeholders share a source the most generous request wins"
        >
          <span className="its-field__name">data limit (optional)</span>
          <input
            type="number"
            min={1}
            value={typeof config.dataLimit === "number" ? String(config.dataLimit) : ""}
            placeholder="All rows"
            onChange={(event) => {
              const parsed = parseInt(event.target.value, 10);
              setField("dataLimit", Number.isNaN(parsed) || parsed < 1 ? undefined : parsed);
            }}
          />
        </label>
      )}
    </div>
  );
}

function dataSourceText(value: JsonValue | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join(", ");
  return "";
}
