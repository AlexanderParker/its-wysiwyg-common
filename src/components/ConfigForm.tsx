import type { ConfigPropertySchema, InstructionTypeDefinition, JsonValue, PlaceholderConfig } from "../types";
import { coercePropertyValue } from "../utils";

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
        <textarea
          rows={2}
          value={config.description ?? ""}
          placeholder="What should the AI generate here? Supports ${variables}."
          onChange={(event) => onChange({ ...config, description: event.target.value })}
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
                <input
                  type="text"
                  value={fieldValue(config[name] as JsonValue | undefined)}
                  onChange={(event) => setField(name, event.target.value === "" ? undefined : event.target.value)}
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
    </div>
  );
}
