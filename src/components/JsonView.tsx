import { useEffect, useRef, useState } from "react";
import type { ItsTemplate } from "../types";
import { isItsTemplateShape } from "../utils";

interface JsonViewProps {
  template: ItsTemplate;
  onChange: (template: ItsTemplate) => void;
  /** Reports whether this tab holds text that is not in the template yet. */
  onPendingChange?: (pending: boolean) => void;
}

export function JsonView({ template, onChange, onPendingChange }: JsonViewProps): JSX.Element {
  const [text, setText] = useState(() => JSON.stringify(template, null, 2));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) {
      setText(JSON.stringify(template, null, 2));
    }
  }, [template, dirty]);

  /*
   * Held in a ref so the effect below depends on the pending state alone. A
   * host passing an inline function gives a new identity on every render; an
   * effect depending on it would report false then true each time, and a host
   * that puts the value in state would render again on each report and never
   * settle.
   */
  const report = useRef(onPendingChange);
  useEffect(() => {
    report.current = onPendingChange;
  }, [onPendingChange]);

  /*
   * Leaving the tab discards the text, so the host is told the pending state
   * is over. Without the cleanup, switching away from a dirty JSON tab would
   * leave a host's save action refusing on account of text that no longer
   * exists and a control that is no longer on screen.
   */
  useEffect(() => {
    report.current?.(dirty);
    return () => report.current?.(false);
  }, [dirty]);

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
