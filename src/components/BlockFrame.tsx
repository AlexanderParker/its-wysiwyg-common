import type { ReactNode } from "react";

interface BlockFrameProps {
  kind: "text" | "placeholder" | "conditional";
  label: ReactNode;
  children: ReactNode;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function BlockFrame({
  kind,
  label,
  children,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  canMoveUp,
  canMoveDown,
}: BlockFrameProps): JSX.Element {
  return (
    <section className={`its-block its-block--${kind}`}>
      <header className="its-block__header">
        <span className="its-block__label">{label}</span>
        <span className="its-block__actions">
          <button type="button" title="Move up" disabled={!canMoveUp} onClick={onMoveUp} aria-label="Move block up">
            ↑
          </button>
          <button type="button" title="Move down" disabled={!canMoveDown} onClick={onMoveDown} aria-label="Move block down">
            ↓
          </button>
          <button type="button" title="Duplicate" onClick={onDuplicate} aria-label="Duplicate block">
            ⧉
          </button>
          <button type="button" title="Delete" className="its-block__delete" onClick={onDelete} aria-label="Delete block">
            ✕
          </button>
        </span>
      </header>
      <div className="its-block__body">{children}</div>
    </section>
  );
}
