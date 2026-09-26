"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { finalizePossiblyCompletedSignedCvUpload } from "@/lib/signedCvUploadFinalization";
import { MAX_ORIGINAL_BYTES } from "@/lib/cvUploadLimits";

type PortalResponse = {
  profile: any;
  verifiedEmail: string;
  version: string;
  profileStatus: string | null;
  searchable: boolean;
  confirmationRequired: boolean;
  missingRequiredFields: string[];
};

const panel = "rounded-2xl border border-slate-800 bg-[#0B0F16] p-5";
const input =
  "mt-2 w-full rounded-lg border border-slate-700 bg-[#05070A] px-3 py-2 text-sm outline-none focus:border-cyan-400";

function value(field: any) {
  return String(field?.value ?? "").trim();
}
function rows(value: any) {
  return Array.isArray(value) ? value : [];
}
function dateValue(value: any) {
  return String(value?.value ?? value ?? "").trim();
}

async function cvContentDigest(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function editableRows(raw: unknown) {
  if (Array.isArray(raw)) return raw as Record<string, any>[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEmployment(items: any[]) {
  return items.map((row) => ({
    employer: value(row.company) || String(row.employer ?? "").trim(),
    title: value(row.title) || String(row.role ?? "").trim(),
    start_date: dateValue(row.startDate || row.start_date),
    end_date: dateValue(row.endDate || row.end_date),
    current:
      row.current === true ||
      /^(current|present|now)$/i.test(dateValue(row.endDate || row.end_date)),
  }));
}

function normalizeProjects(items: any[]) {
  return items.map((row) => ({
    project: value(row.name) || String(row.project ?? "").trim(),
    client: value(row.client) || String(row.client ?? "").trim(),
    role: value(row.role) || String(row.title ?? "").trim(),
    start_date: dateValue(row.startDate || row.start_date),
    end_date: dateValue(row.endDate || row.end_date),
    current:
      row.current === true ||
      /^(current|present|now)$/i.test(dateValue(row.endDate || row.end_date)),
  }));
}

function normalizeEducation(items: any[]) {
  return items.map((row) =>
    typeof row === "string"
      ? { qualification: row }
      : {
          institution: value(row.institution) || String(row.institution ?? ""),
          qualification:
            value(row.qualification) ||
            value(row.degree) ||
            String(row.qualification ?? row.degree ?? ""),
          field_of_study:
            value(row.fieldOfStudy) ||
            value(row.field_of_study) ||
            String(row.field_of_study ?? ""),
          graduation_year:
            value(row.graduationYear) ||
            value(row.graduation_year) ||
            String(row.graduation_year ?? ""),
        },
  );
}

function normalizeLanguages(items: any[]) {
  return items.map((row) =>
    typeof row === "string"
      ? { language: row, proficiency: "" }
      : {
          language:
            value(row.language) ||
            value(row.name) ||
            String(row.language ?? row.name ?? ""),
          proficiency:
            value(row.proficiency) ||
            value(row.level) ||
            String(row.proficiency ?? row.level ?? ""),
        },
  );
}

function normalizeCertifications(items: any[]) {
  return items.map((row) => ({
    name:
      typeof row === "string" ? row : value(row.name) || String(row.name ?? ""),
  }));
}

type EditorColumn = { key: string; label: string; placeholder: string };

function StructuredEditor({
  title,
  rows,
  columns,
  currentable = false,
  required = false,
  onChange,
}: {
  title: string;
  rows: Record<string, any>[];
  columns: EditorColumn[];
  currentable?: boolean;
  required?: boolean;
  onChange: (rows: Record<string, any>[]) => void;
}) {
  const update = (index: number, key: string, next: unknown) =>
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: next } : row,
      ),
    );
  return (
    <section className={panel}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {required ? (
            <p className="mt-1 text-xs text-amber-100">
              At least one complete row is required.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-lg border border-cyan-500/50 px-3 py-2 text-sm text-cyan-100"
          onClick={() => onChange([...rows, {}])}
        >
          Add row
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {rows.length ? (
          rows.map((row, index) => (
            <div
              className="rounded-xl border border-slate-800 bg-[#070A0F] p-4"
              key={`${title}-${index}`}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {columns.map((column) => (
                  <label className="text-sm" key={column.key}>
                    {column.label}
                    <input
                      className={input}
                      value={String(row[column.key] ?? "")}
                      placeholder={column.placeholder}
                      disabled={
                        currentable &&
                        column.key === "end_date" &&
                        row.current === true
                      }
                      onChange={(event) =>
                        update(index, column.key, event.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {currentable ? (
                  <label className="flex gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={row.current === true}
                      onChange={(event) => {
                        const next = rows.map((item, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...item,
                                current: event.target.checked,
                                end_date: event.target.checked
                                  ? ""
                                  : item.end_date,
                              }
                            : item,
                        );
                        onChange(next);
                      }}
                    />
                    Current role/project
                  </label>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="text-sm text-red-300"
                  onClick={() =>
                    onChange(rows.filter((_, rowIndex) => rowIndex !== index))
                  }
                >
                  Remove row
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-amber-100">No record extracted.</p>
        )}
      </div>
    </section>
  );
}

async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body.error === "candidate_profile_incomplete" && body.details?.reasons
        ? body.details.reasons.join(" ")
        : body.error || `Request failed (${response.status}).`,
    );
  return body;
}

export default function CandidatePortalClient() {
  const [data, setData] = useState<PortalResponse | null>(null);
  const [fields, setFields] = useState<Record<string, any>>({});
  const [file, setFile] = useState<File | null>(null);
  const [accuracy, setAccuracy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const next = (await json(
      await fetch("/api/candidate/profile", { cache: "no-store" }),
    )) as PortalResponse;
    const profile = next.profile;
    setData(next);
    setFields({
      displayName: value(profile.displayName),
      email: next.verifiedEmail || value(profile.contactInfo?.email),
      phone: value(profile.contactInfo?.phone),
      currentTitle: value(profile.currentTitle),
      currentCompany: value(profile.currentCompany),
      location: value(profile.location),
      workExperience: JSON.stringify(
        normalizeEmployment(rows(profile.workExperience)),
      ),
      sapModules: rows(profile.sapModules)
        .map((item: any) => value(item.name))
        .filter(Boolean)
        .join(", "),
      techSkills: rows(profile.techSkills)
        .map((item: any) => value(item.name))
        .filter(Boolean)
        .join(", "),
      projectExperience: JSON.stringify(
        normalizeProjects(rows(profile.projectExperience)),
      ),
      education: JSON.stringify(normalizeEducation(rows(profile.education))),
      certifications: JSON.stringify(
        normalizeCertifications(rows(profile.certifications)),
      ),
      languages: JSON.stringify(normalizeLanguages(rows(profile.languages))),
    });
  }, []);

  useEffect(() => {
    load().catch((reason) =>
      setError(
        reason instanceof Error ? reason.message : "Profile unavailable.",
      ),
    );
  }, [load]);

  function set(name: string, next: string) {
    setFields((current) => ({ ...current, [name]: next }));
  }

  function setStructured(name: string, next: Record<string, any>[]) {
    set(name, JSON.stringify(next));
  }

  async function uploadCv() {
    if (!file) return;
    setBusy("upload");
    setError("");
    setMessage("");
    try {
      if (
        !/\.(pdf|docx|doc|rtf|txt)$/i.test(file.name) ||
        file.size > MAX_ORIGINAL_BYTES
      )
        throw new Error("Use one PDF, DOCX, DOC, RTF, or TXT CV up to 20 MB.");
      const contentDigest = await cvContentDigest(file);
      const signed = await json(
        await fetch("/api/candidate/profile/cv/sign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            size: file.size,
            contentDigest,
          }),
        }),
      );
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key)
        throw new Error("Private CV storage is not configured.");
      const storage = createClient(url, key).storage.from(
        "candidate-original-cvs",
      );
      const uploaded = await storage.uploadToSignedUrl(
        signed.objectKey,
        signed.token,
        file,
        { contentType: signed.contentType },
      );
      const result = await finalizePossiblyCompletedSignedCvUpload({
        uploadError: uploaded.error,
        requestProcessing: () =>
          fetch("/api/candidate/profile/cv", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              size: file.size,
              objectKey: signed.objectKey,
              contentDigest,
            }),
          }),
        parseResponse: json,
        transferFailureMessage: "Private CV transfer failed.",
      });
      setMessage(
        result.accepted
          ? "CV processed. Review every extracted section before confirming."
          : "CV was not accepted as a valid SAP profile.",
      );
      setAccuracy(false);
      setSharing(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "CV upload failed.");
    } finally {
      setBusy("");
    }
  }

  async function confirmProfile() {
    if (!data) return;
    setBusy("confirm");
    setError("");
    setMessage("");
    try {
      await json(
        await fetch("/api/candidate/profile/confirmation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt: data.version,
            submittedFields: {
              ...fields,
              confirmAccuracy: accuracy,
              consentToShare: sharing,
            },
          }),
        }),
      );
      setMessage("Profile confirmed and released to recruiter search.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Confirmation failed.",
      );
    } finally {
      setBusy("");
    }
  }

  const profile = data?.profile;
  return (
    <main className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-slate-800 bg-[#070A0F] px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold">Candidate Portal</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Upload your latest SAP CV, check every extracted section, complete
            required details, then confirm what recruiters and clients may use.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-100">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-100">
            {message}
          </div>
        ) : null}
        {!data && !error ? (
          <div className={panel}>Loading your profile…</div>
        ) : null}
        {data && profile ? (
          <>
            <section className={panel}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Profile readiness</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Status: {data.profileStatus || "Not confirmed"}
                  </p>
                </div>
                <span
                  className={`h-fit rounded-full border px-3 py-1 text-sm ${data.searchable ? "border-emerald-500/40 text-emerald-100" : "border-amber-500/40 text-amber-100"}`}
                >
                  {data.searchable ? "Searchable" : "Hidden until complete"}
                </span>
              </div>
              {data.missingRequiredFields.length ? (
                <p className="mt-4 text-sm text-amber-100">
                  Required gaps: {data.missingRequiredFields.join(", ")}
                </p>
              ) : null}
            </section>

            <section className={panel}>
              <h2 className="text-xl font-semibold">Update CV</h2>
              <p className="mt-2 text-sm text-slate-400">
                The same SAP parser is used for admin and candidate uploads.
                Non-SAP files are rejected; an update stays hidden until you
                review and confirm it.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.rtf,.txt"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  disabled={!file || Boolean(busy)}
                  onClick={uploadCv}
                  className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40"
                >
                  {busy === "upload" ? "Processing…" : "Upload latest CV"}
                </button>
              </div>
            </section>

            <section className={panel}>
              <h2 className="text-xl font-semibold">Required information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[
                  ["displayName", "Full name"],
                  ["email", "Verified sign-in email"],
                  ["phone", "Phone"],
                  ["currentTitle", "Current title"],
                  ["currentCompany", "Current employer"],
                  ["location", "Location / country"],
                  ["sapModules", "SAP modules"],
                  ["techSkills", "Skills"],
                ].map(([name, label]) => (
                  <label className="text-sm" key={name}>
                    {label}
                    <input
                      className={input}
                      value={String(fields[name] ?? "")}
                      disabled={name === "email"}
                      onChange={(event) => set(name, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                At least one verified email or phone is required. Employer is
                never taken from a project client field.
              </p>
            </section>

            <StructuredEditor
              title="Employment history"
              required
              currentable
              rows={editableRows(fields.workExperience)}
              columns={[
                {
                  key: "employer",
                  label: "Legal employer",
                  placeholder: "Employer named in the CV",
                },
                {
                  key: "title",
                  label: "Job title",
                  placeholder: "SAP role at this employer",
                },
                {
                  key: "start_date",
                  label: "Start date",
                  placeholder: "YYYY-MM or source precision",
                },
                {
                  key: "end_date",
                  label: "End date",
                  placeholder: "YYYY-MM; leave blank only if Current",
                },
              ]}
              onChange={(next) => setStructured("workExperience", next)}
            />

            <StructuredEditor
              title="SAP project history"
              required
              currentable
              rows={editableRows(fields.projectExperience)}
              columns={[
                {
                  key: "project",
                  label: "Project",
                  placeholder: "Project or programme name",
                },
                {
                  key: "client",
                  label: "Client (not employer)",
                  placeholder: "Customer/client, if stated",
                },
                {
                  key: "role",
                  label: "Project role",
                  placeholder: "Role on this project",
                },
                {
                  key: "start_date",
                  label: "Start date",
                  placeholder: "YYYY-MM; optional if no project dates stated",
                },
                {
                  key: "end_date",
                  label: "End date",
                  placeholder: "YYYY-MM; optional if no project dates stated",
                },
              ]}
              onChange={(next) => setStructured("projectExperience", next)}
            />

            <StructuredEditor
              title="Education"
              required
              rows={editableRows(fields.education)}
              columns={[
                {
                  key: "institution",
                  label: "Institution",
                  placeholder: "University or school",
                },
                {
                  key: "qualification",
                  label: "Qualification",
                  placeholder: "Degree or qualification",
                },
                {
                  key: "field_of_study",
                  label: "Field of study",
                  placeholder: "Major / discipline",
                },
                {
                  key: "graduation_year",
                  label: "Graduation year",
                  placeholder: "Only if known",
                },
              ]}
              onChange={(next) => setStructured("education", next)}
            />

            <StructuredEditor
              title="Languages"
              required
              rows={editableRows(fields.languages)}
              columns={[
                {
                  key: "language",
                  label: "Language",
                  placeholder: "Language",
                },
                {
                  key: "proficiency",
                  label: "Proficiency",
                  placeholder: "Only if known",
                },
              ]}
              onChange={(next) => setStructured("languages", next)}
            />

            <StructuredEditor
              title="Certifications"
              rows={editableRows(fields.certifications)}
              columns={[
                {
                  key: "name",
                  label: "Certification",
                  placeholder: "Certification name",
                },
              ]}
              onChange={(next) => setStructured("certifications", next)}
            />

            <section className={panel}>
              <h2 className="text-xl font-semibold">Confirm accuracy</h2>
              <label className="mt-4 flex gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={accuracy}
                  onChange={(event) => setAccuracy(event.target.checked)}
                />
                I reviewed the extracted profile and confirm it is accurate.
              </label>
              <label className="mt-3 flex gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={sharing}
                  onChange={(event) => setSharing(event.target.checked)}
                />
                I consent to sharing this profile with relevant recruiters and
                clients.
              </label>
              <button
                type="button"
                disabled={!accuracy || !sharing || Boolean(busy)}
                onClick={confirmProfile}
                className="mt-5 rounded-lg bg-emerald-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-40"
              >
                {busy === "confirm"
                  ? "Confirming…"
                  : "Confirm complete profile"}
              </button>
              <p className="mt-3 text-xs text-slate-500">
                Confirmation checks required fields, dates when provided, SAP
                evidence, ownership, version, and search-index readback.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
