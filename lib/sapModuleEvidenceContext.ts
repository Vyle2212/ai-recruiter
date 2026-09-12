const cleanModule = (value: unknown) => String(value || "").toUpperCase().replace(/^SAP\s+/, "").trim();

const DOMAIN_PHRASES: Record<string, RegExp> = {
  MM: /\b(?:materials? management|sourcing and procurement|procure to pay|p2p|purchasing|procurement|inventory management)\b/i,
  SD: /\b(?:sales and distribution|order to cash|o2c|otc)\b/i,
  FI: /\b(?:financial accounting|general ledger|accounts payable|accounts receivable|asset accounting)\b/i,
  CO: /\b(?:controlling|cost center|profit center|internal order|co-?pa)\b/i,
  FICO: /\b(?:finance and controlling|financial accounting and controlling|fi\s*[/ -]\s*co)\b/i,
};

export function hasContextualSapModuleEvidence(source: unknown, requestedModule: unknown) {
  const text = String(source || "").normalize("NFKC");
  const module = cleanModule(requestedModule);
  if (!text || !module) return false;
  const escaped = module.replace(/[.*+?^${}()|[\]\\]/g, "\$&");
  if (new RegExp(`\\bSAP\\s+(?:S\\/4HANA\\s+)?${escaped}\\b`, "i").test(text)) return true;
  if (new RegExp(`\\b${escaped}\\s+(?:consultant|functional|module|configuration|implementation|support|lead|specialist|logistics?)\\b`, "i").test(text)) return true;
  if (new RegExp(`\\b(?:${escaped}\\s*[/&]\\s*[A-Z]{2,5}|[A-Z]{2,5}\\s*[/&]\\s*${escaped})\\b`).test(text)) return true;
  const hasSapProfileContext = /\b(?:SAP|S\/4HANA|S4HANA|SAP\s+ECC)\b/i.test(text);
  if (hasSapProfileContext && new RegExp(`\\b${escaped}\\b`).test(text)) return true;
  const phrase = DOMAIN_PHRASES[module];
  if (!phrase) return false;
  const sapContextualSegments = text.split(/(?<=[.!?\n])\s+/).filter((segment) => /\b(?:SAP|S\/4HANA|S4HANA)\b/i.test(segment));
  return sapContextualSegments.some((segment) => phrase.test(segment));
}

export function hasContextualImplementationProjectEvidence(source: unknown) {
  const text = String(source || '').normalize('NFKC');
  if (!text) return false;
  const segments = text.split(/(?<=[.!?\n])\s+/).filter((segment) => /\bimplement(?:ation|ations|ed|ing)?\b/i.test(segment));
  return segments.some((segment) => {
    if (/\bimplementing\s+(?:the\s+)?(?:tender|documents?|paperwork|policy|policies|standard|standards|procedure|procedures)\b/i.test(segment)) return false;
    return /\b(?:SAP|S\/4HANA|S4HANA|ERP|software|system|platform|solution|configuration|migration|rollout|go[- ]?live|project(?:\s+team)?|full[- ]?(?:life[- ]?)?cycle|end[- ]?to[- ]?end|greenfield|brownfield)\b/i.test(segment);
  });
}
