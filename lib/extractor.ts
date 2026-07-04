import { getSAPKnowledge } from "./sap-system";
import {
  derivePrimaryModule,
  deriveRoleType,
  extractCandidateName,
  extractEmail,
  extractPhone,
  extractLocation,
} from "./cv-parser";

function asArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

function includesSmart(raw: string, keyword: string) {
  const key = String(keyword || "").trim();
  if (!key) return false;

  if (key.length <= 3) {
    return new RegExp(
      `\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    ).test(raw);
  }

  return raw.toLowerCase().includes(key.toLowerCase());
}

export async function extractStructuredData(text: string, fileName?: string) {
  const knowledge = await getSAPKnowledge();

  const SAP_MODULES = asArray((knowledge as any).SAP_MODULES || (knowledge as any).modules);
  const SAP_SUBMODULES = asArray(
    (knowledge as any).SAP_SUBMODULES ||
      (knowledge as any).submodules ||
      (knowledge as any).modules
  );
  const CONSULTING_FIRMS = asArray(
    (knowledge as any).CONSULTING_FIRMS || (knowledge as any).firms
  );

  const raw = String(text || "");
  const lower = raw.toLowerCase();

  const modules = SAP_MODULES.filter((m) => includesSmart(raw, m));
  const submodules = SAP_SUBMODULES.filter((s) => includesSmart(raw, s));

  const primaryModule = derivePrimaryModule(raw);
  const roleType = deriveRoleType(raw, primaryModule);

  return {
    name: extractCandidateName(raw, fileName),
    email: extractEmail(raw),
    phone: extractPhone(raw),
    location: extractLocation(raw),

    modules,
    submodules,

    primaryModule,
    primary_module: primaryModule,

    roleType,
    role_type: roleType,

    consulting: CONSULTING_FIRMS.some((f) =>
      lower.includes(String(f).toLowerCase())
    ),
  };
}

export default extractStructuredData;