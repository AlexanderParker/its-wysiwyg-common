import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Lightweight dialog rendered inside the editor tree so the --its-* theme
 * variables apply. Closes on Escape, backdrop click or the close button;
 * focus moves into the panel on open and back to the opener on close.
 */
export function Modal({ title, onClose, children }: ModalProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="its-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="its-modal__panel"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="its-modal__head">
          <span className="its-modal__title">{title}</span>
          <button type="button" className="its-modal__close" aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="its-modal__body">{children}</div>
      </div>
    </div>
  );
}
