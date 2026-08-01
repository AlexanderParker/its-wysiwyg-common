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

/** Restricts the tree to references that resolve to values of a kind. */
export type ValueFilter = "integer" | "number";

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

function isIntegerValue(value: JsonValue | undefined): boolean {
  return typeof value === "number" && Number.isInteger(value);
}

function matchesFilter(value: JsonValue | undefined, filter: ValueFilter): boolean {
  return filter === "integer" ? isIntegerValue(value) : typeof value === "number";
}

function functionNodes(path: string, first: JsonValue | undefined, filter: ValueFilter | undefined): VariableTreeNode[] {
  const nodes: VariableTreeNode[] = [];
  if (isPlainObject(first)) {
    const keys = Object.keys(first);
    if (filter !== undefined) {
      // Numeric filters keep only aggregations producing that kind: avg can
      // be fractional (number-only), concat and top never qualify
      const matchingKeys = keys.filter((key) => matchesFilter(first[key], filter));
      const functions = filter === "integer" ? ["sum", "min", "max"] : ["sum", "avg", "min", "max"];
      for (const fn of functions) {
        if (matchingKeys.length > 0) {
          nodes.push({
            label: `${fn}(…)`,
            children: matchingKeys.map((key) => ({ label: key, insertPath: `${path}.${fn}(${key})` })),
          });
        }
      }
      return nodes;
    }
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
    if (filter !== undefined) {
      if (matchesFilter(first, filter)) {
        const functions = filter === "integer" ? ["sum", "min", "max"] : ["sum", "avg", "min", "max"];
        for (const fn of functions) {
          nodes.push({ label: `${fn}()`, insertPath: `${path}.${fn}()` });
        }
      }
      return nodes;
    }
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
  filter: ValueFilter | undefined,
): VariableTreeNode {
  if (Array.isArray(value)) {
    const children: VariableTreeNode[] = [{ label: ".length", insertPath: `${path}.length` }];
    if (includeFunctions) {
      children.push(...functionNodes(path, value[0], filter));
    }
    if (depth < MAX_DEPTH) {
      value.slice(0, MAX_INDICES).forEach((item, index) => {
        children.push(nodeFor(`[${index}]`, item, `${path}[${index}]`, depth + 1, includeFunctions, filter));
      });
    }
    return { label, insertPath: filter !== undefined ? undefined : path, children };
  }
  if (isPlainObject(value)) {
    const children =
      depth < MAX_DEPTH
        ? Object.entries(value).map(([key, item]) =>
            nodeFor(key, item, `${path}.${key}`, depth + 1, includeFunctions, filter),
          )
        : undefined;
    return { label, insertPath: filter !== undefined ? undefined : path, children };
  }
  if (filter !== undefined && !matchesFilter(value, filter)) {
    return { label };
  }
  return { label, insertPath: path };
}

function pruneEmpty(nodes: VariableTreeNode[]): VariableTreeNode[] {
  const pruned: VariableTreeNode[] = [];
  for (const node of nodes) {
    const children = node.children === undefined ? undefined : pruneEmpty(node.children);
    const hasChildren = children !== undefined && children.length > 0;
    if (node.insertPath === undefined && !hasChildren) continue;
    pruned.push({ ...node, children: hasChildren ? children : undefined });
  }
  return pruned;
}

/** Builds the variable tree shown by the insertion menu. */
export function buildVariableTree(
  variables: Record<string, JsonValue>,
  includeFunctions: boolean,
  filter?: ValueFilter,
): VariableTreeNode[] {
  const tree = Object.entries(variables).map(([name, value]) =>
    nodeFor(name, value, name, 1, includeFunctions, filter),
  );
  return filter === undefined ? tree : pruneEmpty(tree);
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
  valueFilter?: ValueFilter;
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
  valueFilter,
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
  const tree = buildVariableTree(variables, insertFormat === "template", valueFilter);

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
