# Owned project ledgers — 2026-09-23

## Source group and boundary

Two previously empty sources contain explicitly separate employer and project
customer labels. One repeats `Company → Customer → Project → Duration → Role`
with the date and role labels in either order. The other has an Employment
History `Employer → Project → End-Client → Project Role` record followed by
dated development and support stages. The parser stores the employer and role
in employment, keeps the stated employment dates blank, and links a separately
dated project to that same employer. The existing project-envelope estimator
marks the first-to-last project dates as **estimated**, including time between
same-employer projects. An explicit Client/Customer remains the project client;
it never substitutes for the employer. Numeric stage dates are normalized only
when valid and present in that stage. Current is not assigned to the undated
employment record merely because the project says Present.

De-identified positive and negative regressions cover both label orders,
multiple projects at one employer with an internal gap, client-only and
client-equals-company records, invalid and inverted dates, a References block,
and a sales role that must not count toward SAP delivery experience. The
project client is bounded before a separately labelled Industry field.

## Complete source comparison

Read-only projection of the same private 970-source input: **707 sources /
2,071 employment rows before, 709 sources / 2,075 rows after**. Two sources
recover four source-owned employment roles and four project records. All prior
2,071 employment tuples, the other 968 sources' timelines and projects,
and every prior SAP-experience value remain identical. SAP experience becomes
source-supported for these two sources (11.2 and 1.8 years as of the audit
date, including the explicit Present project stage). These values are
estimates from source-owned SAP project periods and should be reviewed against
the original CV before backfill. No project is created from reference names or
an unowned client. Malformed, duplicate and invalid-range diagnostics stay at
zero; overlapping employment and client/employer equality review flags stay
at 57 and two. **261 sources remain without extracted employment**; those
sources do not necessarily contain qualifying SAP work. The exact same
classifier on the unchanged snapshot groups the 263 previously empty sources
as 180 project/client-heavy, 60 near career heading/date, 14 other narrative
or layout, four short/missing, four explicit employer field, and one headed
table. After this batch the corresponding counts are 179, 60, 14, four,
three, and one. These executable heuristic counts supersede approximate
hand-grouped v98 notes; they are review queues, not adjudicated causes.

This checkpoint contains no identity, source excerpt, CV or contact detail.
It records a read-only code comparison. No database backfill, live OCR,
runtime configuration or acceptance on an authenticated exact artifact was
performed. Production remains **NO_GO** until reviewed source adjudication,
backfill/readback, live OCR and acceptance on the promoted artifact pass.
