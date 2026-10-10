"use client";
import { candidateCallingCodes } from "@/lib/candidateCallingCodes";
import { candidateCountries } from "@/lib/candidateEditOptions";
const choices = Array.from(new Set(Object.values(candidateCallingCodes)))
  .sort((a, b) => Number(a) - Number(b))
  .map((code) => ({
    code,
    names: candidateCountries
      .filter((country) => candidateCallingCodes[country.code] === code)
      .map((c) => c.name)
      .slice(0, 3)
      .join(" / "),
  }));
export default function CandidatePhoneEditor({
  value,
  onChange,
  inputClass,
}: {
  value: string;
  onChange: (value: string) => void;
  inputClass: string;
}) {
  const digits = value.replace(/[^\d+]/g, "");
  const code = digits.startsWith("+")
    ? choices
        .filter((c) => digits.slice(1).startsWith(c.code))
        .sort((a, b) => b.code.length - a.code.length)[0]?.code || ""
    : "";
  const national = code ? digits.slice(code.length + 1) : value;
  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label="Phone country calling code"
          className={inputClass}
          value={code}
          onChange={(e) =>
            onChange(
              (e.target.value ? "+" + e.target.value : "") +
                national.replace(/\D/g, ""),
            )
          }
        >
          <option value="">Calling code</option>
          {choices.map((c) => (
            <option key={c.code} value={c.code}>
              +{c.code} — {c.names || "International"}
            </option>
          ))}
        </select>
        <input
          aria-label="Phone number"
          aria-required
          type="tel"
          className={inputClass}
          value={national}
          placeholder="Phone number"
          onChange={(e) =>
            onChange(
              e.target.value.trim().startsWith("+")
                ? e.target.value
                : (code ? "+" + code : "") + e.target.value,
            )
          }
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Check the number from your CV. Include country code; follow your
        country's numbering format. A calling code does not indicate where you
        live.
      </p>
    </div>
  );
}
