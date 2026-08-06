import { normalizeEvidenceLabels, provenanceForEvidenceItem, type EvidenceItem, type EvidenceStrength } from "./candidate360Evidence";
export type ConfidenceAssessment = { confidence: number | null; evidenceQuality: number; completeness: number; criticalGaps: string[]; rationale: string[] };
const strengthWeight: Record<EvidenceStrength, number> = { weak: 25, moderate: 50, strong: 75, verified: 100 };
export function calibrateConclusionConfidence(input: { evidence: EvidenceItem[]; completeness: number; missingEvidence?: string[]; criticalFields?: string[] }): ConfidenceAssessment {
  const evidence = input.evidence.map(provenanceForEvidenceItem); const completeness = Math.max(0, Math.min(100, Math.round(input.completeness)));
  const critical = new Set((input.criticalFields || []).map((item) => item.toLocaleLowerCase())); const criticalGaps = normalizeEvidenceLabels((input.missingEvidence || []).filter((item) => !critical.size || critical.has(item.toLocaleLowerCase())));
  if (!evidence.length) return { confidence: null, evidenceQuality: 0, completeness, criticalGaps, rationale: ["No supporting evidence is available for this conclusion."] };
  const evidenceQuality = Math.round(evidence.reduce((sum, item) => sum + strengthWeight[item.strength], 0) / evidence.length);
  const diversity = new Set(evidence.map((item) => item.sourceType)).size; let confidence = Math.round(evidenceQuality * .8 + Math.min(100, diversity * 20) * .2);
  if (criticalGaps.length >= 3) confidence = Math.min(confidence, 55); else if (criticalGaps.length === 2) confidence = Math.min(confidence, 65); else if (criticalGaps.length === 1) confidence = Math.min(confidence, 75);
  if (evidence.every((item) => item.strength === "weak")) confidence = Math.min(confidence, 40);
  return { confidence, evidenceQuality, completeness, criticalGaps, rationale: [`Evidence quality: ${evidenceQuality}%.`, `${diversity} independent evidence source type${diversity === 1 ? "" : "s"}.`, criticalGaps.length ? `${criticalGaps.length} critical evidence gap${criticalGaps.length === 1 ? " limits" : "s limit"} confidence.` : "No critical gap limits this conclusion."] };
}
