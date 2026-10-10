import { sourceSupportsSapModuleClaim } from "./sourceSapModuleClaims";

/** Conservative task evidence; module names alone do not prove each specialty.
 * Source definitions: SAP Help FIN-FSCM and SAP Learning TM process overview.
 * https://help.sap.com/saphelp_em700_ehp01/helpdata/en/e9/2ed67bb7564b09ba1fcbe7fe143203/content.htm
 * https://learning.sap.com/courses/planning-and-execution-in-sap-s-4hana-transportation-management/end-to-end-transportation-process
 */
export type SapTaskEvidence = {
  module: "FSCM" | "TM";
  specialization: string;
  involvement:
    | "delivery"
    | "technical_delivery"
    | "integration"
    | "end_user"
    | "exposure";
};
const areas: Array<{
  module: SapTaskEvidence["module"];
  label: string;
  pattern: RegExp;
}> = [
  {
    module: "FSCM",
    label: "Credit Management",
    pattern:
      /\b(?:credit management|credit segments?|credit exposure|UKM000|UKM_BP)\b/i,
  },
  {
    module: "FSCM",
    label: "Collections Management",
    pattern:
      /\b(?:collections management|collection strategies|collections? worklists?)\b/i,
  },
  {
    module: "FSCM",
    label: "Dispute Management",
    pattern: /\b(?:dispute management|dispute cases?)\b/i,
  },
  { module: "FSCM", label: "Biller Direct", pattern: /\bBiller Direct\b/i },
  {
    module: "TM",
    label: "Transportation Planning",
    pattern:
      /\b(?:transportation cockpit|freight unit building|transportation planning|load optimization|carrier selection)\b/i,
  },
  {
    module: "TM",
    label: "Transportation Execution",
    pattern:
      /\b(?:freight order management|freight bookings?|transportation execution)\b/i,
  },
  {
    module: "TM",
    label: "Charge Calculation",
    pattern:
      /\b(?:charge calculation|calculation sheets?|freight agreements?|rate tables?)\b/i,
  },
  {
    module: "TM",
    label: "Freight Settlement",
    pattern: /\bfreight settlement(?: documents?)?\b/i,
  },
];
export function extractSapTaskSpecializations(
  source: string,
): SapTaskEvidence[] {
  const result: SapTaskEvidence[] = [];
  for (const segment of source.normalize("NFKC").split(/[\n;]|(?<=[.!?])\s+/)) {
    if (!/\b(?:SAP|S\/?4HANA|FSCM)\b/i.test(segment)) continue;
    if (
      /\b(?:no|without|lack(?:ing)?)\s+(?:hands[- ]on\s+)?(?:experience|exposure|knowledge)\b/i.test(
        segment,
      )
    )
      continue;
    let involvement: SapTaskEvidence["involvement"] =
      /\b(?:training in|trained in|course|certification|familiar with|awareness of|exposure to|observed)\b/i.test(
        segment,
      )
        ? "exposure"
        : /\b(?:integrat\w*|interfaces?|liais\w*|coordinat\w*)\b/i.test(segment)
          ? "integration"
          : /\b(?:configured|configuring|configuration|customiz\w*|customis\w*|implemented|implementing|designed|developed|debugged)\b/i.test(
                segment,
              )
            ? "delivery"
            : /\b(?:end[- ]user|processed|posted|used|operated|ran)\b/i.test(
                  segment,
                )
              ? "end_user"
              : "exposure";
    if (/\bend[- ]user\b/i.test(segment)) involvement = "end_user";
    else if (
      involvement === "delivery" &&
      /\b(?:ABAP|BAdI|BAPI|custom code|enhancements?)\b/i.test(segment) &&
      /\b(?:developed|debugged|coded|implemented)\b/i.test(segment)
    )
      involvement = "technical_delivery";
    for (const area of areas) {
      if (!area.pattern.test(segment)) continue;
      // Generic pricing terms also occur in SD and other products. Require
      // transportation context before assigning the TM charge specialty.
      if (
        area.module === "TM" &&
        area.label === "Charge Calculation" &&
        !/\b(?:TM|transportation|freight|forwarding)\b/i.test(segment)
      )
        continue;
      if (
        area.module === "FSCM" &&
        area.label === "Credit Management" &&
        !sourceSupportsSapModuleClaim("FSCM", segment)
      )
        continue;
      // "TM" also means Talent Management or a telecom company. A domain task
      // and SAP context are required, never the bare acronym alone.
      if (area.module === "TM" && /\btalent management\b/i.test(segment))
        continue;
      const item = {
        module: area.module,
        specialization: area.label,
        involvement,
      };
      if (
        !result.some(
          (x) =>
            x.module === item.module &&
            x.specialization === item.specialization &&
            x.involvement === item.involvement,
        )
      )
        result.push(item);
    }
  }
  return result;
}
