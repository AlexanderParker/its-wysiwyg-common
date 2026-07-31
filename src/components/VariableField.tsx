import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useEditorContext } from "../context";
import type { JsonValue } from "../types";

/**
 * Text inputs and textareas that support right-click variable insertion:
 * the context menu shows the template's variables as an expandable tree
 * (object properties, array indices, .length and collection functions) and
 * inserts a reference at the caret. Template fields insert ${path};
 * condition fields insert the bare path and omit functions, which are not
 * valid in conditional expressions.
 */

export type InsertFormat = "template" | "bare";

export interface VariableTreeNode {
  label: string;
  insertPath?: string;
  children?: VariableTreeNode[];
}

const MAX_INDICES = 10;
const MAX_DEPTH = 4;
const TOP_CHOICES = [1, 3, 5, 10];

function isPlainObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value);
}

function functionNodes(path: string, first: JsonValue | undefined): VariableTreeNode[] {
  const nodes: VariableTreeNode[] = [];
  if (isPlainObject(first)) {
    const keys = Object.keys(first);
    const numericKeys = keys.filter((key) => typeof first[key] === "number");
    nodes.push({
      label: "concat(…)",
      children: keys.map((key) => ({ label: key, insertPath: `${path}.concat(${key})` })),
    });
    for (const fn of ["sum", "avg", "min", "max"]) {
      if (numericKeys.length > 0) {
        nodes.push({
          label: `${fn}(…)`,
          children: numericKeys.map((key) => ({ label: key, insertPath: `${path}.${fn}(${key})` })),
        });
      }
    }
  } else {
    nodes.push({ label: "concat()", insertPath: `${path}.concat()` });
    if (typeof first === "number") {
      for (const fn of ["sum", "avg", "min", "max"]) {
        nodes.push({ label: `${fn}()`, insertPath: `${path}.${fn}()` });
      }
    }
  }
  nodes.push({
    label: "top(…)",
    children: TOP_CHOICES.map((count) => ({ label: String(count), insertPath: `${path}.top(${count})` })),
  });
  return nodes;
}

function nodeFor(
  label: string,
  value: JsonValue | undefined,
  path: string,
  depth: number,
  includeFunctions: boolean,
): VariableTreeNode {
  if (Array.isArray(value)) {
    const children: VariableTreeNode[] = [{ label: ".length", insertPath: `${path}.length` }];
    if (includeFunctions) {
      children.push(...functionNodes(path, value[0]));
    }
    if (depth < MAX_DEPTH) {
      value.slice(0, MAX_INDICES).forEach((item, index) => {
        children.push(nodeFor(`[${index}]`, item, `${path}[${index}]`, depth + 1, includeFunctions));
      });
    }
    return { label, insertPath: path, children };
  }
  if (isPlainObject(value)) {
    const children =
      depth < MAX_DEPTH
        ? Object.entries(value).map(([key, item]) => nodeFor(key, item, `${path}.${key}`, depth + 1, includeFunctions))
        : undefined;
    return { label, insertPath: path, children };
  }
  return { label, insertPath: path };
}

/** Builds the variable tree shown by the insertion menu. */
export function buildVariableTree(
  variables: Record<string, JsonValue>,
  includeFunctions: boolean,
): VariableTreeNode[] {
  return Object.entries(variables).map(([name, value]) => nodeFor(name, value, name, 1, includeFunctions));
}

interface MenuState {
  x: number;
  y: number;
}

function TreeItem({
  node,
  depth,
  onInsert,
}: {
  node: VariableTreeNode;
  depth: number;
  onInsert: (path: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children !== undefined && node.children.length > 0;
  return (
    <>
      <div className="its-varmenu__row" style={{ paddingLeft: `${depth * 0.8}rem` }}>
        {hasChildren ? (
          <button
            type="button"
            className="its-varmenu__toggle"
            aria-label={open ? "Collapse" : "Expand"}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="its-varmenu__toggle its-varmenu__toggle--empty" />
        )}
        {node.insertPath !== undefined ? (
          <button type="button" className="its-varmenu__insert" role="menuitem" onClick={() => onInsert(node.insertPath!)}>
            {node.label}
          </button>
        ) : (
          <button
            type="button"
            className="its-varmenu__insert its-varmenu__insert--group"
            aria-label={`Expand ${node.label}`}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(!open);
            }}
          >
            {node.label}
          </button>
        )}
      </div>
      {open && node.children?.map((child, index) => (
        <TreeItem key={`${child.label}-${index}`} node={child} depth={depth + 1} onInsert={onInsert} />
      ))}
    </>
  );
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
  const tree = buildVariableTree(variables, insertFormat === "template");

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
    if (tree.length === 0) return; // fall through to the browser menu
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
        {tree.map((node, index) => (
          <TreeItem key={`${node.label}-${index}`} node={node} depth={0} onInsert={insert} />
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
