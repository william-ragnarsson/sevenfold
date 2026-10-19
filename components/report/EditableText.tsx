"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * A value that turns into a text box when clicked. Blur or ⌘/Ctrl+Enter saves
 * (Enter alone too, unless `multiline`); Esc puts it back. `onSave` is called
 * only when the trimmed text changed, and may get "" when the box was cleared.
 * `children` is how the value looks when not being edited.
 */
export function EditableText({
  value,
  onSave,
  label,
  multiline = true,
  placeholder = "add",
  className = "",
  initiallyEditing = false,
  onDone,
  block = false,
  children,
}: {
  value: string;
  onSave: (value: string) => void;
  /** What the value is, for screen readers: "Company name", say. */
  label: string;
  multiline?: boolean;
  /** Shown in place of an empty value. */
  placeholder?: string;
  /** Extra classes for the text box, so it can match the value's type. */
  className?: string;
  /** Open with the box already showing, for a row that was just added. */
  initiallyEditing?: boolean;
  /** Called whenever an edit ends, saved or not, after any `onSave`. */
  onDone?: () => void;
  /** Lay the value out as a block, for a value drawn as a list or the like. */
  block?: boolean;
  children?: ReactNode;
}) {
  const [draft, setDraft] = useState<string | null>(initiallyEditing ? value : null);
  const box = useRef<HTMLTextAreaElement>(null);
  // Esc and a save both end the edit, and the box's blur can follow either;
  // only the first one counts.
  const closed = useRef(false);

  // Grow the box with its text, so editing reads like the value it replaced.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const open = () => {
    closed.current = false;
    setDraft(value);
  };

  const close = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    const next = (box.current?.value ?? "").trim();
    setDraft(null);
    if (save && next !== value.trim()) onSave(next);
    onDone?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(false);
    } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      close(true);
    }
  };

  if (draft !== null) {
    return (
      <textarea
        ref={box}
        autoFocus
        rows={1}
        value={draft}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => close(true)}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
        className={`-mx-1.5 -my-0.5 block w-[calc(100%+0.75rem)] resize-none overflow-hidden rounded-md bg-white px-1.5 py-0.5 text-ink/90 outline-none ring-1 ring-accent/40 focus:ring-2 ${className}`}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title="Click to edit"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={`${block ? "block" : ""} -mx-1 cursor-text rounded px-1 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent`}
    >
      <span className="sr-only">Edit {label}: </span>
      {value ? children ?? value : <span className="text-sm italic text-ink/30">{placeholder}</span>}
    </span>
  );
}
