"use client";
import { useState } from "react";
import {
  candidateDateParts,
  candidateMonths,
} from "@/lib/candidatePortalEditEvidence";
export default function CandidateDateEditor({
  value,
  onChange,
  inputClass,
  disabled = false,
  allowCurrent = false,
  current = false,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  inputClass: string;
  disabled?: boolean;
  allowCurrent?: boolean;
  current?: boolean;
  label: string;
}) {
  const parts = candidateDateParts(current && !value ? "Current" : value);
  const [pendingMonth, setPendingMonth] = useState("");
  const month = parts.month || pendingMonth;
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
          value={current ? "Current" : month}
          onChange={(e) => {
            if (e.target.value === "Current") {
              setPendingMonth("");
              onChange("Current");
              return;
            }
            setPendingMonth(e.target.value);
            if (current || parts.year === "Current") {
              onChange("");
              return;
            }
            if (parts.year && parts.year !== "Current")
              onChange(
                `${parts.year}${e.target.value ? "-" + e.target.value : ""}`,
              );
          }}
        >
          <option value="">Month</option>
          {allowCurrent ? <option value="Current">Current</option> : null}
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
          value={current ? "Current" : parts.year}
          onChange={(e) => {
            setPendingMonth("");
            onChange(
              e.target.value === "Current"
                ? "Current"
                : e.target.value
                  ? `${e.target.value}${month && month !== "Current" ? "-" + month : ""}`
                  : "",
            );
          }}
        >
          <option value="">Year</option>
          {allowCurrent ? <option value="Current">Current</option> : null}
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      <input
        aria-label={`${label} exact value`}
        className={inputClass}
        disabled={disabled}
        value={current && !value ? "Current" : value}
        placeholder="YYYY-MM or source year"
        onChange={(e) => {
          setPendingMonth("");
          onChange(e.target.value);
        }}
      />
    </div>
  );
}
