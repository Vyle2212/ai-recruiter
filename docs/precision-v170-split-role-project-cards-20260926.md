# Precision v170: preserve named projects with split role labels

A project card can put its `Role` value on the next line while keeping
`Duration: Jan 2022 - Dec 2023` on one line. The explicit reader previously
missed that duration, leaving the secondary client reader to recover an
assignment without the source's project name. It now reads either inline or
split duration labels within the same bounded card.

An empty `Role` or `Role:` must not turn the next `Duration` label into a
role. Both the explicit and canonical native-card readers reject another
project field label as a value. Synthetic admin and candidate ingestion tests
cover the named project and both empty-role forms. Existing project ownership
tests cover a partial card followed by another client or project.

The read-only audit used the same 905 original files, 892 distinct contents,
as v169. It found 558 valid project rows versus 560 at v169, with 1,859
employment rows in both. Four profiles were automatically complete for
validation, 779 still required review, 44 PDF layouts remained unresolved,
and 15 PDFs required OCR; these counts and the zero source failures did not
change. The audit counts valid rows, not the completeness of project names,
so it cannot quantify how many original CVs gained a named project. The
two-row decrease is not treated as proof of improved coverage. There were no
database writes and the collection is not ready for bulk upload.
