import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useEditorContext } from "../context";
import type { JsonValue } from "../types";

/**
 * Text inputs and textareas that support right-click variable insertion:
 * the context menu lists the template's variable paths and inserts a
 * reference at the caret. Template fields insert ${path}; condition fields
 * insert the bare path, matching conditional expression syntax.
 */

export type InsertFormat = "template" | "bare";

interface MenuState {
  x: number;
  y: number;
}

/** Enumerates useful variable paths: nested object keys and first-element array paths, depth-capped. */
export function variablePaths(variables: Record<string, JsonValue>, maxDepth = 3, cap = 60): string[] {
  const paths: string[] = [];

  const walk = (value: JsonValue | undefined, path: string, depth: number): void => {
    if (paths.length >= cap) return;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (path.length > 0) paths.push(path);
      if (depth < maxDepth) {
        for (const [key, item] of Object.entries(value)) {
          walk(item, path.length === 0 ? key : `${path}.${key}`, depth + 1);
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      paths.push(path);
      paths.push(`${path}.length`);
      if (depth < maxDepth && value.length > 0) {
        walk(value[0], `${path}[0]`, depth + 1);
      }
      return;
    }
    paths.push(path);
  };

  for (const [name, value] of Object.entries(variables)) {
    walk(value, name, 1);
  }
  return [...new Set(paths)].slice(0, cap);
}

interface VariableFieldProps {
  as: "input" | "textarea";
  value: string;
  onValueChange: (value: string) => void;
  insertFormat?: InsertFormat;
  className?: string;
  placeholder?: string;
  rows?: number;
  spellCheck?: boolean;
  title?: string;
  ariaLabel?: string;
  onBlur?: () => void;
}

export function VariableField({
  as,
  value,
  onValueChange,
  insertFormat = "template",
  className,
  placeholder,
  rows,
  spellCheck,
  title,
  ariaLabel,
  onBlur,
}: VariableFieldProps): JSX.Element {
  const { variables } = useEditorContext();
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const paths = variablePaths(variables);

  useEffect(() => {
    if (menu === null) return;
    const close = (): void => setMenu(null);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const openMenu = (event: React.MouseEvent): void => {
    if (paths.length === 0) return; // fall through to the browser menu
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY });
  };

  const insert = (path: string): void => {
    const field = fieldRef.current;
    const insertion = insertFormat === "bare" ? path : `\${${path}}`;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? start;
    onValueChange(value.slice(0, start) + insertion + value.slice(end));
    setMenu(null);
    requestAnimationFrame(() => {
      if (field) {
        field.focus();
        const caret = start + insertion.length;
        field.setSelectionRange(caret, caret);
      }
    });
  };

  const shared = {
    className,
    placeholder,
    spellCheck,
    title,
    "aria-label": ariaLabel,
    value,
    onContextMenu: openMenu,
    onBlur,
  };

  const menuNode: ReactNode = menu && (
    <div
      className="its-varmenu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label="Insert variable"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="its-varmenu__title">Insert variable</span>
      <div className="its-varmenu__list">
        {paths.map((path) => (
          <button type="button" key={path} role="menuitem" onClick={() => insert(path)}>
            {insertFormat === "bare" ? path : `\${${path}}`}
          </button>
        ))}
      </div>
    </div>
  );

  if (as === "textarea") {
    return (
      <>
        <textarea
          {...shared}
          rows={rows}
          ref={(node) => {
            fieldRef.current = node;
          }}
          onChange={(event) => onValueChange(event.target.value)}
        />
        {menuNode}
      </>
    );
  }
  return (
    <>
      <input
        {...shared}
        type="text"
        ref={(node) => {
          fieldRef.current = node;
        }}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {menuNode}
    </>
  );
}
