# Exported career history batch — 2026-09-16

## Current state

Parser `candidate-employment-v76-exported-career-cards` was checked against all 970 source records from the verified nine-original backfill snapshot. This is a **local parser comparison**, not an additional production database write or authenticated deployment acceptance. The preceding nine-original production backfill remains verified in [the population checkpoint](precision-full-population-audit-20260916.md).

## Population-first prioritization

All 558 sources without extracted employment were screened before changing the reader: 312 had an employment/career heading (including fused labels), 205 had project/client content without that heading, 23 had explicit employer labels, 14 were other content, and four were short sources. These overlapping signals were assigned in the stated priority order (short, explicit label, heading, project/client, other); they are review queues, not assertions that every source is a valid or complete CV.

A large, bounded group of 74 unresolved sources shared an exported `Career history` label joined to the first role. Their cards explicitly state `role at employer start – end (printed duration)`. The reader now recovers adjacent cards using those field boundaries. It retains full dotted company names and full titles, including abbreviations and non-SAP roles. The printed duration is a delimiter only; it never fills an absent date or overrides explicit dates.

Education/skills sections, client/project-prefixed headings, invalid ranges, missing endpoints and narrative continuations cannot become employment cards. Narrative after the last adjacent card stops this reader; recovery is not a claim that every subsequent role in the CV is complete.

The older prose reader skips only matches whose dated endpoint is inside an already parsed card's exact source span. This prevents clipped employer suffixes and duplicated fragments without editing the underlying source or erasing a separately evidenced role elsewhere with similar text. No candidate names, company allowlists or per-person rules are used.

## Full comparison

| Metric | Before (v75) | After (v76) |
| --- | ---: | ---: |
| Source records audited | 970 | 970 |
| Records with employment | 412 | 486 |
| Employment rows | 1,267 | 1,491 |
| Records without extracted employment | 558 | 484 |
| Malformed / duplicate / invalid-range rows | 0 / 0 / 0 | 0 / 0 / 0 |
| Possible client/employer equality flags | 2 | 2 |
| Overlapping-history review flags | 38 | 53 |

The change affects 211 source projections, including all 74 previously empty sources in the targeted group. There are 262 new tuples and 38 replaced tuples, for **224 net additional rows**. Every replaced tuple has a same-tenure replacement with the full employer or corrected title supported by its original card. Dates were not shifted. Review of the 38 replacements found clipped company suffixes, title fragments, lost seniority/specialisms and one capitalization-only difference; this is not a claim that all old tuples are byte-identical.

The 15 additional overlap flags expose concurrently stated source periods, including repeated roles and multiple entries marked current. Exact-span ownership prevents parser-created duplicate fragments; inconsistent source histories remain reviewable and are not silently repaired by inventing end dates. Overlap is counted once in experience calculations. The existing continuous same-employer SAP policy and exclusion of accounting, sales and end-user work are unchanged.

Baseline and proposed projections are compared with the process cache cleared between versions; otherwise the shared canonical cache could return the baseline projection twice. An independent fresh-process full audit confirms the proposed counts.

## Remaining groups

The original coarse review taxonomy now contains 224 employment-heading/layout sources, 93 project/client-heavy sources, 11 explicit-field sources, 18 non-SAP/education-oriented sources and 138 other sources: **484 total**. Fused career exports were spread across the old categories; 62 were other-review, ten project/client-heavy and two non-SAP/education-oriented.

Next work must review field ownership in the remaining bounded headings and labelled forms, distinguish CVs from other documents, and resolve source conflicts. Do not request originals already available or treat non-SAP histories as missing SAP work. Private metadata, before/after tuples and source evidence are retained outside this repository.

## Verification and release

Twenty-seven local employment/source/date/OCR/search regression files and TypeScript checks pass. The new anonymized suite covers fused/adjacent cards, dotted legal names and title abbreviations, non-SAP roles, explicit endpoint precedence, original span ownership, repeated phrases and project/date isolation. It is included in mandatory Production Trust CI. Exact-commit CI must pass before merge.

Production remains **NO_GO**: no new database backfill or deployment was performed for v76. Remaining source review, live Google OCR with persisted provenance, any further reviewed backfill, and authenticated acceptance against the exact artifact are still required. Build or preview success does not satisfy those gates.
