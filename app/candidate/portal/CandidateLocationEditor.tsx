"use client";
import { useId } from "react";
import {
  candidateCountries,
  candidateCitySuggestions,
  splitCandidateLocation,
  joinCandidateLocation,
} from "@/lib/candidateEditOptions";
export default function CandidateLocationEditor({
  value,
  onChange,
  inputClass,
}: {
  value: string;
  onChange: (value: string) => void;
  inputClass: string;
}) {
  const id = useId();
  const location = splitCandidateLocation(value);
  const code =
    candidateCountries.find((item) => item.name === location.country)?.code ||
    "";
  return (
    <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
      <label className="text-sm">
        Country <span className="text-amber-200">*</span>
        <select
          aria-required
          className={
            location.country
              ? inputClass
              : inputClass.replace("border-slate-700", "border-amber-400")
          }
          value={location.country}
          onChange={(event) =>
            onChange(joinCandidateLocation("", event.target.value))
          }
        >
          <option value="">Select country</option>
          {candidateCountries.map((item) => (
            <option key={item.code} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        City <span className="text-xs text-slate-400">Optional</span>
        <input
          className={inputClass}
          value={location.city}
          list={id}
          placeholder="Choose or type your city"
          onChange={(event) =>
            onChange(
              joinCandidateLocation(event.target.value, location.country),
            )
          }
        />
        <datalist id={id}>
          {(candidateCitySuggestions[code] || []).map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </label>
      <p className="text-xs text-slate-400 md:col-span-2">
        Choose where you currently live. Changing country clears the city; you
        can type any city if it is not suggested.
      </p>
    </div>
  );
}
