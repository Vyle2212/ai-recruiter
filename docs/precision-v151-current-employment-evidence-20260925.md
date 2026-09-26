# Current employment evidence in the shared CV parser

Admin and candidate uploads use `prepareCandidateCv`. This batch closes two
historical-employment fallbacks in its shared normalization and extraction
stages. A completed job cannot establish a current employer or role. The
full extractor also rejects an explicitly dated `at Company` phrase when its
end date is historical. Explicit current fields and open-ended current jobs
remain available; a missing current employer stays missing for review.

The offline aggregate audit now reports `current_employer`, `current_title`,
`contact` and `skills` separately. Placeholder `Not disclosed` no longer counts
as a completed profile field. The same synthetic ended/current employment
fixtures run in Production Trust CI.

Private read-only audit of the same 905 originals, 892 unique file bytes:

| Aggregate | Previous PR tree | This parser tree |
| --- | ---: | ---: |
| Complete for validation | 2 | 2 |
| Missing current employer | bundled in `other` | 431 |
| Missing contact | bundled in `other` | 31 |
| Missing languages | 361 | 361 |
| Missing valid employment | 179 | 180 |
| Missing valid projects | 660 | 660 |
| Valid employment rows | 1790 | 1788 |
| Valid project rows | 511 | 511 |
| PDF requiring OCR | 14 | 14 |
| PDF employment layout unresolved | 60 | 60 |
| Source failures | 0 | 0 |

The earlier `other` count was 397; it cannot be interpreted as the earlier
current-employer count. These are structural extraction checks, not verified
field-level accuracy. At least 78 additional distinct originals are needed
to reach a 970-unique-file target. No production database, Storage or candidate
record was changed; replacing existing profiles and bulk upload remain blocked
until current restore evidence, private Storage/RLS and a real synthetic
upload/OCR/readback pass.
