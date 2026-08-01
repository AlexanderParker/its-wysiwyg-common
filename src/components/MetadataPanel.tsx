import type { ItsTemplate, SchemaOption } from "../types";

interface MetadataPanelProps {
  template: ItsTemplate;
  onChange: (template: ItsTemplate) => void;
  schemaOptions?: SchemaOption[];
}

const CUSTOM = "__custom__";

export function MetadataPanel({ template, onChange, schemaOptions = [] }: MetadataPanelProps): JSX.Element {
  const metadata = template.metadata ?? {};
  const extendsList = template.extends ?? [];

  const setMeta = (key: "name" | "description" | "author", value: string): void => {
    const next = { ...metadata };
    if (value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange({ ...template, metadata: Object.keys(next).length > 0 ? next : undefined });
  };

  const setExtends = (urls: string[]): void => {
    onChange({ ...template, extends: urls.length > 0 ? urls : undefined });
  };

  const setEntry = (index: number, url: string): void => {
    setExtends(extendsList.map((entry, i) => (i === index ? url : entry)));
  };

  return (
    <div className="its-metadata">
      <label className="its-field its-field--wide">
        <span className="its-field__name">Template name</span>
        <input type="text" value={metadata.name ?? ""} onChange={(event) => setMeta("name", event.target.value)} />
      </label>
      <label className="its-field its-field--wide">
        <span className="its-field__name">Description</span>
        <textarea
          rows={2}
          value={metadata.description ?? ""}
          onChange={(event) => setMeta("description", event.target.value)}
        />
      </label>
      <label className="its-field its-field--wide">
        <span className="its-field__name">Author</span>
        <input type="text" value={metadata.author ?? ""} onChange={(event) => setMeta("author", event.target.value)} />
      </label>
      <label className="its-field its-field--wide">
        <span className="its-field__name">Version</span>
        <input
          type="text"
          value={template.version}
          onChange={(event) => onChange({ ...template, version: event.target.value })}
        />
      </label>
      <div className="its-field its-field--wide">
        <span className="its-field__name">Extends (type library schemas)</span>
        {extendsList.map((url, index) => {
          const known = schemaOptions.some((option) => option.url === url);
          const selectValue = known ? url : CUSTOM;
          return (
            <div className="its-schemarow" key={index}>
              <select
                className="its-schemarow__select"
                aria-label={`Schema ${index + 1}`}
                value={selectValue}
                onChange={(event) => {
                  const next = event.target.value;
                  setEntry(index, next === CUSTOM ? "" : next);
                }}
              >
                {schemaOptions.map((option) => (
                  <option key={option.url} value={option.url}>
                    {option.label}
                  </option>
                ))}
                <option value={CUSTOM}>Custom URL</option>
              </select>
              {!known && (
                <input
                  type="text"
                  className="its-mono its-schemarow__url"
                  placeholder="https://example.com/schemas/my-types.json"
                  spellCheck={false}
                  aria-label={`Schema ${index + 1} URL`}
                  value={url}
                  onChange={(event) => setEntry(index, event.target.value)}
                />
              )}
              <button
                type="button"
                className="its-schemarow__remove"
                title="Remove schema"
                aria-label={`Remove schema ${index + 1}`}
                onClick={() => setExtends(extendsList.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="its-branch__toggle its-schemarow__add"
          onClick={() => {
            const unused = schemaOptions.find((option) => !extendsList.includes(option.url));
            setExtends([...extendsList, unused ? unused.url : ""]);
          }}
        >
          + Add schema
        </button>
      </div>
      <p className="its-hint">
        Instruction types resolve with later schemas overriding earlier ones; this template's own custom instruction
        types override everything.
      </p>
    </div>
  );
}
