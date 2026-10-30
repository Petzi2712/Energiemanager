import { fieldHelp } from "./inputHints";
import React, { useEffect, type ReactNode } from "react";
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div className="notice error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function Field({
  label,
  children,
  help,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  const id = React.useId();
  const props = React.isValidElement(children)
    ? (children.props as {
        type?: string;
        min?: number;
        max?: number;
        title?: string;
      })
    : {};
  const hint =
    help || props.title || fieldHelp(label, props.type, props.min, props.max);
  function positionHelp(event: React.SyntheticEvent<HTMLSpanElement>) {
    const anchor = event.currentTarget.getBoundingClientRect();
    const tooltip =
      event.currentTarget.querySelector<HTMLElement>(".input-tooltip");
    if (!tooltip) return;
    const width = Math.min(290, window.innerWidth - 24);
    tooltip.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, anchor.left - width / 2))}px`;
    tooltip.style.top = `${Math.max(12, anchor.top - tooltip.offsetHeight - 9)}px`;
  }
  return (
    <div className="field">
      <div className="field-label">
        <label htmlFor={id}>{label}</label>
        <span
          className="input-help"
          onMouseEnter={positionHelp}
          onFocus={positionHelp}
        >
          <button
            type="button"
            className="help-button"
            aria-label={`Eingabehilfe: ${label}`}
            aria-describedby={`${id}-help`}
          >
            ?
          </button>
          <span className="input-tooltip" id={`${id}-help`} role="tooltip">
            {hint}
          </span>
        </span>
      </div>
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<{
              id?: string;
              title?: string;
              "aria-describedby"?: string;
            }>,
            {
              id,
              title: hint,
              "aria-describedby": `${id}-help`,
            },
          )
        : children}
    </div>
  );
}
export function Badge({
  active,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`badge ${active ? "positive" : ""}`}>{children}</span>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="dialog-title">
      <div className="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" aria-label="Dialog schließen" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
