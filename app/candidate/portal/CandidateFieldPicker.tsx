"use client";
import { useState } from "react";
export default function CandidateFieldPicker({
  value,
  options,
  onChange,
  inputClass,
  placeholder,
  disabled = false,
  required = false,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  inputClass: string;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div>
      <div className="flex items-stretch gap-1">
        <input
          className={inputClass}
          aria-label={placeholder}
          aria-required={required}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery(event.target.value);
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="mt-2 rounded-lg border border-slate-700 px-3 text-sm"
          aria-label={`Choose ${placeholder}`}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            setQuery("");
          }}
        >
          ▾
        </button>
      </div>
      {open && !disabled ? (
        <div className="mt-1 rounded-lg border border-slate-700 bg-slate-950 p-2">
          <input
            aria-label={`Filter ${placeholder}`}
            className={inputClass}
            placeholder="Filter choices…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-2 max-h-44 overflow-auto">
            {filtered.length ? (
              filtered.map((option) => (
                <button
                  type="button"
                  key={option}
                  className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-800 focus:bg-slate-800"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {option}
                </button>
              ))
            ) : (
              <p className="p-2 text-xs text-slate-400">
                No suggestion. You can type your value above.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
