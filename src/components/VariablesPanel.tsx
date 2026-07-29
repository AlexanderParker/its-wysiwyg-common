import { useState } from "react";
import type { JsonValue } from "../types";
import { formatJsonValue, parseVariableInput } from "../utils";

interface VariablesPanelProps {
  variables: Record<string, JsonValue>;
  onChange: (variables: Record<string, JsonValue>) => void;
  referencedNames?: Set<string>;
}

export function VariablesPanel({ variables, onChange, referencedNames }: VariablesPanelProps): JSX.Element {
  const [newName, setNewName] = useState("");
  const names = Object.keys(variables);

  const rename = (oldName: string, name: string): void => {
    if (name === oldName) return;
    const next: Record<string, JsonValue> = {};
    for (const key of names) {
      next[key === oldName ? name : key] = variables[key];
    }
    onChange(next);
  };

  const setValue = (name: string, raw: string): void => {
    onChange({ ...variables, [name]: parseVariableInput(raw) });
  };

  const remove = (name: string): void => {
    const next = { ...variables };
    delete next[name];
    onChange(next);
  };

  const addVariable = (): void => {
    const name = newName.trim();
    if (name === "" || name in variables) return;
    onChange({ ...variables, [name]: "" });
    setNewName("");
  };

  return (
    <div className="its-variables">
      <p className="its-hint">
        Variables are referenced in content as <code>{"${name}"}</code>, with dot access for objects and{" "}
        <code>{"[0]"}</code> for arrays. Values are parsed as JSON where valid; anything else is stored as a string.
      </p>
      {names.length === 0 && <p className="its-blocklist__empty">No variables defined.</p>}
      {names.map((name) => {
        const isObjectLike = typeof variables[name] === "object" && variables[name] !== null;
        return (
          <div className="its-varrow" key={name}>
            <div className="its-varrow__head">
              <input
                className="its-varrow__name"
                type="text"
                value={name}
                onChange={(event) => rename(name, event.target.value)}
                aria-label="Variable name"
              />
              {referencedNames && !isReferenced(name, referencedNames) && (
                <span className="its-varrow__unused" title="No ${...} reference to this variable was found in the content">
                  unused
                </span>
              )}
              <button type="button" className="its-varrow__delete" onClick={() => remove(name)} aria-label={`Delete ${name}`}>
                ✕
              </button>
            </div>
            <textarea
              className="its-varrow__value"
              rows={isObjectLike ? 5 : 1}
              value={formatJsonValue(variables[name])}
              onChange={(event) => setValue(name, event.target.value)}
              aria-label={`Value of ${name}`}
            />
          </div>
        );
      })}
      <div className="its-varadd">
        <input
          type="text"
          placeholder="New variable name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addVariable();
          }}
        />
        <button type="button" onClick={addVariable} disabled={newName.trim() === "" || newName.trim() in variables}>
          Add variable
        </button>
      </div>
    </div>
  );
}

function isReferenced(name: string, referencedNames: Set<string>): boolean {
  for (const ref of referencedNames) {
    if (ref === name || ref.startsWith(`${name}.`) || ref.startsWith(`${name}[`)) return true;
  }
  return false;
}
