import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractCandidateName } from "@/lib/extractCandidateName";
import {
  classifyCandidateText,
  derivePrimaryModuleStrict,
  extractCandidateNameStrict,
  isWeakOrGarbageName,
} from "@/lib/candidateFileGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeValue(value: any) {
  return cleanText(value).toLowerCase();
}

function sameText(a: any, b: any) {
  return normalizeValue(a) === normalizeValue(b);
}

function stripPortalSuffix(value: any) {
  let output = cleanText(value);

  for (let i = 0; i < 3; i++) {
    const before = output;
    output = output
      .replace(/\bSeek\b$/i, "")
      .replace(/\bAsk\b$/i, "")
      .replace(/\bJobstreet\b$/i, "")
      .replace(/\bJobStreet\b$/i, "")
      .replace(/\bLinkedin\b$/i, "")
      .replace(/\bLinkedIn\b$/i, "")
      .replace(/\bIndeed\b$/i, "")
      .replace(/\bMonster\b$/i, "")
      .replace(/\bNaukri\b$/i, "")
      .trim();
    if (before === output) break;
  }

  return output;
}

function hasPortalSuffix(value: any) {
  return /\b(Seek|Ask|Jobstreet|JobStreet|Linkedin|LinkedIn|Indeed|Monster|Naukri)\b$/i.test(
    cleanText(value)
  );
}

function titleCasePersonName(value: any) {
  return stripPortalSuffix(value)
    .replace(/^Career\s*history/i, "")
    .replace(/^Employment\s*history/i, "")
    .replace(/^Full\s*Name\s*[:\-]?\s*/i, "")
    .replace(/^Candidate\s*Name\s*[:\-]?\s*/i, "")
    .replace(/^Name\s*[:\-]?\s*/i, "")
    .replace(/^Mr\.?\s+/i, "")
    .replace(/^Ms\.?\s+/i, "")
    .replace(/^Mrs\.?\s+/i, "")
    .replace(/^[<~\-\s]+|[<~\-\s]+$/g, "")
    .split(/\s+/)
    .map((part) => {
      const p = part.replace(/[^\p{L}.'’-]/gu, "");
      if (!p) return "";
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(" ");
}

function looksLikeWeakStoredName(value: any) {
  const v = cleanText(value);
  if (!v) return true;

  const lower = v.toLowerCase();
  if (isWeakOrGarbageName(v)) return true;
  if (hasPortalSuffix(v)) return true;

  const badPatterns = [
    "review required",
    "profile under review",
    "personal particular",
    "career history",
    "career objective",
    "professional summary",
    "profile summary",
    "technical skills",
    "job title name",
    "candidate name",
    "capital market",
    "software testing",
    "robot framework",
    "procedures",
    "test scripts",
    "hobbies",
  ];

  return badPatterns.some((pattern) => lower.includes(pattern));
}

function normalizeTitle(value: any) {
  const title = cleanText(value)
    .replace(/^Career\s*history\s*/i, "")
    .replace(/^Employment\s*history\s*/i, "")
    .replace(/^Professional\s*Experience\s*/i, "")
    .replace(
      /^(TITLE|POSITION|DESIGNATION|CURRENT\s+POSITION|CURRENT\s+TITLE|ROLE|JOB\s+TITLE)\s*[:\-]\s*/i,
      ""
    )
    .replace(/\s+at\s+$/i, "")
    .slice(0, 180)
    .trim();

  if (!title) return null;

  const weakTitlePatterns = [
    /^personal particulars?$/i,
    /^candidate information$/i,
    /^career objective$/i,
    /^professional summary$/i,
    /^profile summary$/i,
    /^key competencies$/i,
    /^hobbies/i,
    /^skills$/i,
    /^resume of/i,
    /^curriculum vitae/i,
  ];

  if (weakTitlePatterns.some((pattern) => pattern.test(title))) return null;
  return title;
}

function shouldRepairTitle(currentTitle: any, title: any, headline: any) {
  const combined = cleanText(currentTitle || title || headline);
  if (!combined) return false;

  return (
    /^Career\s*history/i.test(combined) ||
    /^Employment\s*history/i.test(combined) ||
    combined.includes("Career history") ||
    combined.includes("Employment history") ||
    /^SAP Consultant$/i.test(combined) ||
    /^Consultant$/i.test(combined) ||
    /^SAP Analyst$/i.test(combined)
  );
}

function isUnknownModule(value: any) {
  const v = cleanText(value).toUpperCase();
  return !v || v === "UNKNOWN" || v === "NULL" || v === "N/A" || v === "GENERAL_SAP";
}

function hasSapSignal(value: any) {
  const t = cleanText(value);
  return /\b(SAP|S\/4HANA|S4HANA|ABAP|FICO|FI\/CO|BASIS|SUCCESSFACTORS|BTP|BW|MM|SD|PP|PM|QM|EWM|TM|ARIBA|CONCUR|MDG|GRC)\b/i.test(
    t
  );
}

function hasErpButNoSap(value: any) {
  const t = cleanText(value);
  return /\bERP\b/i.test(t) && !hasSapSignal(t);
}

/**
 * Existing data repair must be conservative.
 * We should not delete or mark non_sap unless the signal is very strong.
 * For old records, many Seek/Jobstreet exports have weak text but may still be useful SAP leads.
 */
function shouldSoftDeleteAsJD(classification: any, rawText: string) {
  if (classification?.recordType !== "JD") return false;
  if (Number(classification?.confidence || 0) < 0.9) return false;

  const jdSignals = [
    /\bjob description\b/i,
    /\bkey responsibilities\b/i,
    /\bjob requirements\b/i,
    /\brequirements and qualifications\b/i,
    /\bwe are hiring\b/i,
    /\bcandidate must have\b/i,
    /\babout the role\b/i,
  ];

  return jdSignals.some((pattern) => pattern.test(rawText));
}

function shouldMarkAsNonSap(classification: any, c: any, rawText: string) {
  if (classification?.recordType !== "NON_SAP_CV") return false;
  if (Number(classification?.confidence || 0) < 0.9) return false;

  const combined = cleanText([
    c.name,
    c.title,
    c.current_title,
    c.headline,
    c.primary_module,
    rawText,
  ].join(" "));

  // Do not mark ERP/consulting profiles as non_sap automatically.
  // These should be reviewed manually because some SAP CVs only say ERP in exported profiles.
  if (hasSapSignal(combined) || hasErpButNoSap(combined)) return false;

  return true;
}

async function rebuildCandidate(candidateId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await fetch(`${baseUrl}/api/admin/rebuild-candidate?id=${candidateId}`, {
      method: "POST",
    });
  } catch {
    // Non-blocking. Full rebuild can be run after repair.
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dryRun =
      url.searchParams.get("dryRun") === "1" ||
      url.searchParams.get("dryRun") === "true";
    const limit = Number(url.searchParams.get("limit") || 1000);

    const { data, error } = await supabase
      .from("candidates")
      .select(
        "id,name,email,phone,title,current_title,headline,primary_module,secondary_modules,sap_modules,skills,raw_text,resume_text,raw_cv,status"
      )
      .limit(limit);

    if (error) throw error;

    const rows = data || [];
    const actions: any[] = [];
    const summary = {
      repairedName: 0,
      repairedModule: 0,
      repairedTitle: 0,
      restoredSapStatus: 0,
      markedNonSap: 0,
      markedDeletedJd: 0,
    };

    for (const c of rows) {
      const rawText = cleanText(c.raw_text || c.resume_text || c.raw_cv || "");
      const classification = classifyCandidateText(rawText, "existing-candidate");

      const update: Record<string, any> = {};
      const changes: string[] = [];

      if (shouldSoftDeleteAsJD(classification, rawText)) {
        if (c.status !== "deleted") {
          update.status = "deleted";
          changes.push("marked_deleted_jd");
          summary.markedDeletedJd += 1;
        }
      } else if (shouldMarkAsNonSap(classification, c, rawText)) {
        if (c.status !== "non_sap") {
          update.status = "non_sap";
          changes.push("marked_non_sap");
          summary.markedNonSap += 1;
        }
      } else {
        const isSapCv = classification?.recordType === "SAP_CV";
        const sapConfidence = Number(classification?.confidence || 0);
        const hasAnySapSignal = hasSapSignal([
          c.name,
          c.title,
          c.current_title,
          c.headline,
          c.primary_module,
          rawText,
        ].join(" "));

        if (isSapCv || hasAnySapSignal) {
          const strictName = extractCandidateNameStrict(rawText, c.email);
          const flexibleName = extractCandidateName(rawText, c.email);
          const betterName = !looksLikeWeakStoredName(strictName)
            ? titleCasePersonName(strictName)
            : !looksLikeWeakStoredName(flexibleName)
              ? titleCasePersonName(flexibleName)
              : null;

          const betterModule = derivePrimaryModuleStrict({
            ...c,
            raw_text: rawText,
            resume_text: rawText,
            raw_cv: rawText,
          });

          const betterTitle = normalizeTitle(c.current_title || c.title || c.headline);

          if (
            betterName &&
            (looksLikeWeakStoredName(c.name) || hasPortalSuffix(c.name)) &&
            !sameText(betterName, c.name)
          ) {
            update.name = betterName;
            changes.push("repaired_name");
            summary.repairedName += 1;
          }

          if (
            betterModule &&
            isUnknownModule(c.primary_module) &&
            !sameText(betterModule, c.primary_module)
          ) {
            update.primary_module = betterModule;
            changes.push("repaired_module");
            summary.repairedModule += 1;
          }

          if (
            betterTitle &&
            shouldRepairTitle(c.current_title, c.title, c.headline) &&
            !sameText(betterTitle, c.current_title)
          ) {
            update.current_title = betterTitle;
            update.title = betterTitle;
            changes.push("repaired_title");
            summary.repairedTitle += 1;
          }

          if (
            (sapConfidence >= 0.95 || hasAnySapSignal) &&
            (c.status === "non_sap" ||
              c.status === "needs_review" ||
              c.status === "deleted")
          ) {
            update.status = null;
            changes.push("restored_sap_status");
            summary.restoredSapStatus += 1;
          }
        }
      }

      // Critical: do not count/update rows where only updated_at would change.
      if (changes.length > 0) {
        update.updated_at = new Date().toISOString();

        actions.push({
          id: c.id,
          name: c.name,
          action: changes.join(","),
          update,
          classification: {
            recordType: classification?.recordType,
            confidence: classification?.confidence,
            reason: classification?.reason,
          },
        });

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("candidates")
            .update(update)
            .eq("id", c.id);
          if (updateError) throw updateError;
          await rebuildCandidate(c.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      scanned: rows.length,
      changed: actions.length,
      summary,
      actions,
      message: dryRun
        ? "Dry run only. Add ?dryRun=0 or remove dryRun to apply."
        : "Candidate data repaired. Run full rebuild-search-index after this.",
    });
  } catch (error: any) {
    console.error("Repair candidate data failed:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Repair failed." },
      { status: 500 }
    );
  }
}
