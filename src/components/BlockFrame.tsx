import type { ReactNode } from "react";
import { BlockActionsMenu, type BlockActions } from "./BlockActionsMenu";

interface BlockFrameProps extends BlockActions {
  kind: "text" | "placeholder" | "conditional" | "json";
  label: ReactNode;
  children: ReactNode;
}

export function BlockFrame({ kind, label, children, ...actions }: BlockFrameProps): JSX.Element {
  return (
    <section className={`its-block its-block--${kind}`}>
      <header className="its-block__header">
        <span className="its-block__label">{label}</span>
        <BlockActionsMenu {...actions} />
      </header>
      <div className="its-block__body">{children}</div>
    </section>
  );
}
