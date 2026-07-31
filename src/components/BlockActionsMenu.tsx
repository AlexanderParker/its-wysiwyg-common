import { useEffect, useRef, useState } from "react";

export interface BlockActions {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/**
 * The per-block actions behind a single icon: clicking or tapping it opens
 * a small menu of move, insert, duplicate and delete actions. Closes on
 * outside click or Escape.
 */
export function BlockActionsMenu(actions: BlockActions): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (action: () => void): void => {
    action();
    setOpen(false);
  };

  return (
    <span className="its-actionsmenu" ref={rootRef}>
      <button
        type="button"
        className="its-actionsmenu__trigger"
        title="Block actions"
        aria-label="Block actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋮
      </button>
      {open && (
        <div className="its-actionsmenu__panel" role="menu">
          <button type="button" role="menuitem" disabled={!actions.canMoveUp} onClick={() => run(actions.onMoveUp)}>
            ↑ Move up
          </button>
          <button type="button" role="menuitem" disabled={!actions.canMoveDown} onClick={() => run(actions.onMoveDown)}>
            ↓ Move down
          </button>
          <button type="button" role="menuitem" onClick={() => run(actions.onInsertBefore)}>
            + Insert before
          </button>
          <button type="button" role="menuitem" onClick={() => run(actions.onInsertAfter)}>
            + Insert after
          </button>
          <button type="button" role="menuitem" onClick={() => run(actions.onDuplicate)}>
            ⧉ Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="its-actionsmenu__delete"
            onClick={() => run(actions.onDelete)}
          >
            ✕ Delete
          </button>
        </div>
      )}
    </span>
  );
}
