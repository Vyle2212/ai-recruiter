# Piped career row ownership — 2026-09-23

## Source comparison

Read-only re-projection of the same private 970-source snapshot. Against the
v90 checkpoint (703 sources, 2,042 employment rows), the corrected parser
preserves all 2,042 prior employer/title/date tuples and adds 11 source-owned
rows across three sources. Two previously empty sources now contain employment:
**705/970 sources, 2,053 rows; 265 sources without extracted employment**.

The first v91 projection (706/2,065) was invalidated by cross-row date
borrowing. Even the subsequent 97fbd9f2 head produced 706/2,060 on this
snapshot: some titles incorporated duties, a location became an employer, and
reversed `employer | title` rows were read as `title | employer`. These counts
must not be used as accuracy evidence. The new reader bounds the title to the
role immediately before the pipe and rejects a preceding date range, a role
or location after the pipe, and project/client labels. It preserves an
abbreviated role such as `SR. ANALYST` and prevents a preceding organization
in a duties list from joining the next title. De-identified positive and
negative examples cover these layouts and a genuine `SAP` employer.

Malformed narratives, duplicate records and invalid ranges remain zero;
possible client/employer conflicts remain two. Overlap flags are 58 versus
57 in the v90 checkpoint. The additional flag is supported by two concurrent
roles in related organizations with the same source dates; it requires human
review and is not a parser-invented employment range. Dates and role types
remain as recorded; SAP experience does not include unrelated job titles.

## Remaining review groups

Heuristic, mutually exclusive queues for the **265** remaining sources:

| Review queue | Sources | Why no automatic employment was promoted |
| --- | ---: | --- |
| Project/client-heavy | 182 | Employer tenure cannot be taken from a client or project without ownership evidence. |
| Near heading/date | 60 | Row boundaries or dates need layout review. |
| Other narrative/layout | 14 | No unambiguous employer/title/date row in the current text. |
| Explicit employer label | 4 | Fields need association review. |
| Short or missing text | 4 | Available text is insufficient for a safe employment row. |
| Headed table | 1 | Column ownership needs original-layout review. |

These are routing counts, not proof that all 265 CVs contain qualifying SAP
employment. No CV, candidate identifier, contact detail or raw source text is
committed. No database write or deployed OCR test was performed. Production
remains **NO_GO** pending reviewed backfill/readback, live OCR and authenticated
acceptance on the exact deployable artifact.
