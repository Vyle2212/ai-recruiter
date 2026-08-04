import { NextResponse } from "next/server";
import OpenAI from "openai";
import { enrichCandidateWithSapTaxonomy } from "@/lib/sapTalentTaxonomy";
import { evaluateResumeQualityGate } from "@/lib/resumeQualityGate";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("PARSE CV API HIT");

    const cvText = body.cvText;

    if (!cvText || cvText.length < 20) {
      return NextResponse.json(
        {
          error: "No text found",
        },
        {
          status: 400,
        }
      );
    }

    const prompt = `
Extract candidate information from this CV.

Return ONLY valid JSON.

Use SAP module taxonomy. Detect ALL SAP modules mentioned in title, skills, project experience, and summary.
Important examples:
- SAP BTP / Business Technology Platform / SAP Cloud Platform / Integration Suite / Extension Suite => BTP
- SAP CPI / Cloud Integration / HCI => CPI
- PI/PO / Process Integration / Process Orchestration => PI_PO
- BW/4HANA / BW4HANA => BW4HANA
- SAP SuccessFactors / SF / Employee Central => SUCCESSFACTORS
- SAP FICO / FI CO / FI/CO / Finance and Controlling => FICO

Return this JSON shape:
{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "current_location": "",
  "current_title": "",
  "years_experience": "",
  "skills": [],
  "summary": "",
  "primary_module": "",
  "sap_modules": [],
  "sap_submodules": [],
  "secondary_modules": [],
  "role_type": "Functional | Technical | Techno-Functional | Leadership | Unknown",
  "consulting_level": "Consultant | Senior Consultant | Lead | Manager | Director | Partner | Unknown",
  "expected_salary": ""
}

CV:
${cvText}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content || "{}";

    console.log(raw);

    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const enriched = enrichCandidateWithSapTaxonomy({
      ...parsed,
      raw_text: cvText,
      resume_text: cvText,
    });

    const parserQuality = evaluateResumeQualityGate(enriched);

    return NextResponse.json({
      ...enriched,
      parser_quality: parserQuality,
      profile_quality_score: parserQuality.parserQualityScore,
      name_review_required: parserQuality.needsManualReview,
      ranking_eligible: parserQuality.allowedForRanking,
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        error: "AI parsing failed",
      },
      {
        status: 500,
      }
    );
  }
}


