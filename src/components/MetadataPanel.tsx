import type { ItsTemplate } from "../types";

interface MetadataPanelProps {
  template: ItsTemplate;
  onChange: (template: ItsTemplate) => void;
}

export function MetadataPanel({ template, onChange }: MetadataPanelProps): JSX.Element {
  const metadata = template.metadata ?? {};

  const setMeta = (key: "name" | "description" | "author", value: string): void => {
    const next = { ...metadata };
    if (value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange({ ...template, metadata: Object.keys(next).length > 0 ? next : undefined });
  };

  const setExtends = (raw: string): void => {
    const urls = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    onChange({ ...template, extends: urls.length > 0 ? urls : undefined });
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
      <label className="its-field its-field--wide">
        <span className="its-field__name">Extends (one schema URL per line)</span>
        <textarea
          rows={3}
          className="its-mono"
          value={(template.extends ?? []).join("\n")}
          onChange={(event) => setExtends(event.target.value)}
        />
      </label>
      <p className="its-hint">
        Instruction types resolve with later schemas overriding earlier ones; this template's own custom instruction
        types override everything.
      </p>
    </div>
  );
}
