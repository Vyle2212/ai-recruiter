"use client";
import { useId, useRef, useState } from "react";
export default function CandidateFieldPicker({
  value,
  options,
  onChange,
  inputClass,
  placeholder,
  disabled = false,
  required = false,
  allowCustom = true,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  inputClass: string;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  allowCustom?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const filtered = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  );
  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
    setActive(-1);
  }
  function show() {
    setQuery("");
    setActive(-1);
    setOpen(true);
  }
  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          if (!allowCustom && open) {
            const exact = options.find(
              (option) => option.toLowerCase() === query.trim().toLowerCase(),
            );
            if (exact) onChange(exact);
          }
          setOpen(false);
          setQuery("");
          setActive(-1);
        }
      }}
    >
      <input
        ref={inputRef}
        className={`${inputClass} pr-10`}
        role="combobox"
        aria-label={placeholder}
        aria-required={required}
        aria-autocomplete="list"
        aria-expanded={open && !disabled}
        aria-controls={listId}
        aria-activedescendant={
          open && active >= 0 && filtered[active]
            ? `${listId}-${active}`
            : undefined
        }
        disabled={disabled}
        value={!allowCustom && open ? query : value}
        placeholder={placeholder}
        onFocus={show}
        onClick={() => {
          if (!open) show();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
          if (allowCustom) onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setQuery("");
            setActive(-1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
            setActive((previous) =>
              filtered.length
                ? event.key === "ArrowDown"
                  ? Math.min(previous + 1, filtered.length - 1)
                  : Math.max(previous - 1, 0)
                : -1,
            );
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (active >= 0 && filtered[active]) choose(filtered[active]);
            else {
              const exact = options.find(
                (option) => option.toLowerCase() === query.trim().toLowerCase(),
              );
              if (exact) choose(exact);
              else if (allowCustom) choose(value);
            }
          }
        }}
      />
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        className="absolute right-0 top-2 bottom-0 flex w-9 items-center justify-center rounded-r-lg text-slate-300 disabled:opacity-40"
        aria-label={`Choose ${placeholder}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            setOpen(false);
            setQuery("");
          } else {
            inputRef.current?.focus();
            show();
          }
        }}
      >
        ▾
      </button>
      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          aria-label={`${placeholder} choices`}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-xl"
        >
          {filtered.length ? (
            filtered.map((option, index) => (
              <div
                id={`${listId}-${index}`}
                key={option}
                role="option"
                aria-selected={option === value}
                className={`cursor-pointer rounded px-3 py-2 text-sm hover:bg-slate-800 ${active === index ? "bg-slate-800" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
              >
                {option}
              </div>
            ))
          ) : (
            <p className="p-2 text-xs text-slate-400">
              {allowCustom
                ? "No suggestion. Your typed value will be kept."
                : "No matching country. Type another name or choose from the list."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
