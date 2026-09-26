# Employer headers and separate client/company project ledgers — 2026-09-23

## Bounded source layouts

On the same private 970-source snapshot, 238 sources had no extracted
employment at v104. This batch reads two layouts with different date semantics:

- A `Work Experience:` employer header has an employer, location, its own
  `Duration`, role, and a following `Project#` marker. Repeated project
  `Duration` fields beneath that marker cannot replace the employer header's
  dates. Title-cased company tokens prevent an adjacent duty sentence from
  becoming part of the employer name. Four roles are supported.
- Under `Professional Experience`, numbered cards separate `Client`,
  `Company`, `Project`, `Duration` and `Role`. The three closed ranges recovered
  here are **project dates**. Corresponding employment rows retain blank
  original start/end fields; the project model separately labels an estimated
  same-employer envelope, including any interval between projects. A fourth
  card has `till date` in an undated, evidently historical CV and is withheld:
  its completion/current status needs source adjudication before SAP experience
  may be counted through today.

De-identified positive and negative regressions cover employer/client
separation, project date isolation, role ownership, adjacent duty prose,
reversed ranges, absent fields, and the unsafe open project card. No person,
contact, source excerpt or original filename is published.

## Full read-only comparison

The 970 records increase from **732 sources / 2,148 employment rows** to
**734 sources / 2,155 rows**. Two previously empty sources gain four
source-dated header roles and three project-backed roles respectively. All
**2,148** prior employer/title/start/end/current tuples are unchanged.
The project-backed source gains three separately attributed projects and one
labelled same-employer estimate; the other **969** sources' projects and
estimates are unchanged. Only the two newly populated sources change their
SAP experience values, based on source-supported spans.

Malformed narrative, duplicate and invalid-range diagnostics remain zero;
overlap review flags remain 58 and possible client/employer equality remains
two. All 34 local regression files, TypeScript typecheck and the complete
source comparison pass.

The **236 remaining sources** route to these heuristic review queues:

| Review queue | Count | Reason |
| --- | ---: | --- |
| Project/client-heavy | 175 | Assignment dates do not establish employer ownership |
| Career heading/date | 41 | Employer, role or date boundary remains unresolved |
| Other narrative/layout | 14 | No supported repeating employer-role boundary |
| Short or missing source | 4 | Insufficient source text |
| Explicit employer field | 1 | Field ownership needs review |
| Headed table | 1 | Column ownership needs review |

These are triage counts, not a claim that every source has employment. This
batch did not backfill or read back database rows. Production remains
**NO_GO** pending source adjudication, version-matched reviewed backfill and
readback, live OCR with persisted provenance, and authenticated acceptance
on the exact promoted artifact.
