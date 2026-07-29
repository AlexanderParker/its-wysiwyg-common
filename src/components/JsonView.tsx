import { useEffect, useState } from "react";
import type { ItsTemplate } from "../types";
import { isItsTemplateShape } from "../utils";

interface JsonViewProps {
  template: ItsTemplate;
  onChange: (template: ItsTemplate) => void;
}

export function JsonView({ template, onChange }: JsonViewProps): JSX.Element {
  const [text, setText] = useState(() => JSON.stringify(template, null, 2));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) {
      setText(JSON.stringify(template, null, 2));
    }
  }, [template, dirty]);

  const apply = (): void => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isItsTemplateShape(parsed)) {
        setError('Not a valid ITS template: a "version" string and "content" array are required.');
        return;
      }
      setError(null);
      setDirty(false);
      onChange(parsed);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Invalid JSON");
    }
  };

  return (
    <div className="its-jsonview">
      <textarea
        className="its-jsonview__text its-mono"
        spellCheck={false}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setDirty(true);
        }}
      />
      <div className="its-jsonview__bar">
        {error && <span className="its-jsonview__error">{error}</span>}
        {dirty && !error && <span className="its-jsonview__pending">Unapplied changes</span>}
        <button
          type="button"
          onClick={() => {
            setText(JSON.stringify(template, null, 2));
            setDirty(false);
            setError(null);
          }}
          disabled={!dirty}
        >
          Revert
        </button>
        <button type="button" className="its-primary" onClick={apply} disabled={!dirty}>
          Apply JSON
        </button>
      </div>
    </div>
  );
}
