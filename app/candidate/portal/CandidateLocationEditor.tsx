"use client";
import CandidateFieldPicker from "./CandidateFieldPicker";
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
  const location = splitCandidateLocation(value);
  const code =
    candidateCountries.find((item) => item.name === location.country)?.code ||
    "";
  return (
    <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
      <label className="text-sm">
        Country <span className="text-amber-200">*</span>
        <CandidateFieldPicker
          required
          allowCustom={false}
          inputClass={
            location.country
              ? inputClass
              : inputClass.replace("border-slate-700", "border-amber-400")
          }
          value={location.country}
          options={candidateCountries.map((item) => item.name)}
          placeholder="Country"
          onChange={(country) => {
            if (country !== location.country)
              onChange(joinCandidateLocation("", country));
          }}
        />
      </label>
      <label className="text-sm">
        City <span className="text-xs text-slate-400">Optional</span>
        <CandidateFieldPicker
          inputClass={inputClass}
          value={location.city}
          options={candidateCitySuggestions[code] || []}
          placeholder="City"
          onChange={(city) =>
            onChange(joinCandidateLocation(city, location.country))
          }
        />
      </label>
      <p className="text-xs text-slate-400 md:col-span-2">
        Choose where you currently live. Changing country clears the city; you
        can type any city if it is not suggested.
      </p>
    </div>
  );
}
