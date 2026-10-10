"use client";
import { useState, useEffect } from "react";
import {
  candidateDateParts,
  candidateMonths,
} from "@/lib/candidatePortalEditEvidence";
export default function CandidateDateEditor({
  value,
  onChange,
  inputClass,
  disabled = false,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  inputClass: string;
  disabled?: boolean;
  label: string;
}) {
  const parts = candidateDateParts(value);
  const [month, setMonth] = useState(parts.month);
  useEffect(() => setMonth(candidateDateParts(value).month), [value]);
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: currentYear - 1939 }, (_, i) =>
    String(currentYear - i),
  );
  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label={`${label} month`}
          disabled={disabled}
          className={inputClass}
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            if (parts.year)
              onChange(
                `${parts.year}${e.target.value ? "-" + e.target.value : ""}`,
              );
          }}
        >
          <option value="">Month</option>
          {candidateMonths.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} year`}
          disabled={disabled}
          className={inputClass}
          value={parts.year}
          onChange={(e) =>
            onChange(
              e.target.value
                ? `${e.target.value}${month ? "-" + month : ""}`
                : "",
            )
          }
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      <input
        aria-label={`${label} exact value`}
        className={inputClass}
        disabled={disabled}
        value={value}
        placeholder="YYYY-MM or source year"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
