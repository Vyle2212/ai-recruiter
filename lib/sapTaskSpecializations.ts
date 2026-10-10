import { sourceSupportsSapModuleClaim } from "./sourceSapModuleClaims";

/** Conservative task evidence; module names alone do not prove each specialty.
 * Source definitions: SAP Help FIN-FSCM and SAP Learning TM process overview.
 * https://help.sap.com/saphelp_em700_ehp01/helpdata/en/e9/2ed67bb7564b09ba1fcbe7fe143203/content.htm
 * https://learning.sap.com/courses/planning-and-execution-in-sap-s-4hana-transportation-management/end-to-end-transportation-process
 */
export type SapTaskEvidence = {
  module: "FSCM" | "TRM" | "CASH_MANAGEMENT" | "TM" | "EWM";
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
    module: "EWM",
    label: "Warehouse Structure and Storage Control",
    pattern:
      /\b(?:warehouse structur(?:e|ing)|storage control|storage types?|storage bins?)\b/i,
  },
  {
    module: "EWM",
    label: "Inbound Warehouse Processes",
    pattern: /\b(?:inbound processes?|inbound deliver(?:y|ies)|putaway)\b/i,
  },
  {
    module: "EWM",
    label: "Outbound Warehouse Processes",
    pattern:
      /\b(?:outbound processes?|outbound deliver(?:y|ies)|picking|packing)\b/i,
  },
  {
    module: "TRM",
    label: "Debt and Investment Management",
    pattern:
      /\b(?:debt management|investment management|financial instruments?|money market|securities)\b/i,
  },
  {
    module: "TRM",
    label: "Financial Risk and Hedging",
    pattern:
      /\b(?:hedge accounting|hedging|financial risk management|foreign exchange risk|interest rate risk)\b/i,
  },
  {
    module: "CASH_MANAGEMENT",
    label: "Cash Visibility and Bank Accounts",
    pattern: /\b(?:cash visibility|cash positions?|bank account management)\b/i,
  },
  {
    module: "CASH_MANAGEMENT",
    label: "Liquidity Planning and Forecasting",
    pattern:
      /\b(?:liquidity planning|liquidity forecasting|cash forecasting|cash flow forecasting)\b/i,
  },
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
  {
    module: "TM",
    label: "Carrier Management and Tendering",
    pattern:
      /\b(?:carrier management|carrier selection|freight tendering|tendering)\b/i,
  },
];
export function extractSapTaskSpecializations(
  source: string,
): SapTaskEvidence[] {
  const result: SapTaskEvidence[] = [];
  // Inherit only an explicit SAP domain heading into its immediately adjacent
  // bullet list. Blank lines, prose, employers and new headings stop ownership.
  const segments: string[] = [];
  let heading = "";
  let remaining = 0;
  for (const line of source.normalize("NFKC").split(/\r?\n/)) {
    const text = line.trim();
    if (!text) {
      heading = "";
      remaining = 0;
      continue;
    }
    if (/^[-*•]\s+/.test(text)) {
      segments.push(
        heading && remaining > 0 && !/\b(?:SAP|S\/?4HANA)\b/i.test(text)
          ? `${heading}: ${text}`
          : text,
      );
      remaining = Math.max(0, remaining - 1);
      if (/\b(?:SAP|S\/?4HANA)\b/i.test(text)) {
        heading = "";
        remaining = 0;
      }
      continue;
    }
    heading = "";
    remaining = 0;
    if (
      /^(?:(?:role|project|module)\s*:\s*)?SAP\s+(?:EWM|Extended Warehouse Management|TM|Transportation Management|TRM|Treasury(?: and Risk Management)?|FSCM|Cash(?: and Liquidity)? Management)(?:\s+(?:(?:Functional|Technical)\s+)?(?:Consultant|Lead|Manager|Project))?\s*:?$/i.test(
        text,
      )
    ) {
      heading = text;
      remaining = 8;
    }
    segments.push(text);
  }
  for (const segment of segments.flatMap((text) =>
    text.split(/;|(?<=[.!?])\s+/),
  )) {
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
          : /\b(?:configured|configuring|configuration|customiz\w*|customis\w*|implemented|implementing|designed|developed|debugged|coded)\b/i.test(
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
    else if (
      involvement === "delivery" &&
      /\b(?:SAPUI5|UI5|RAP|CAP)\b/i.test(segment) &&
      /\b(?:developed|debugged|coded)\b/i.test(segment)
    )
      involvement = "technical_delivery";
    for (const area of areas) {
      if (!area.pattern.test(segment)) continue;
      if (
        area.module === "EWM" &&
        !/\b(?:EWM|Extended Warehouse Management)\b/i.test(segment)
      )
        continue;
      // A finance or procurement keyword alone does not establish SAP
      // treasury/cash/TM implementation experience.
      if (area.module === "TRM" && !/\b(?:TRM|treasury)\b/i.test(segment))
        continue;
      if (
        area.module === "CASH_MANAGEMENT" &&
        !/\b(?:cash management|cash and liquidity management)\b/i.test(segment)
      )
        continue;
      if (
        area.label === "Carrier Management and Tendering" &&
        !/\b(?:TM|transportation|freight|carriers?)\b/i.test(segment)
      )
        continue;
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
