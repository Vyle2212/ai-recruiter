# Labelled project cards in the shared CV parser

Admin and candidate uploads continue to use the same `prepareCandidateCv`
pipeline. This batch adds a bounded project-card reader for project sections
whose labels occur in different orders or place their values on the following
line. A card is accepted only with a client, role, ordered date range, SAP
evidence and delivery evidence. Missing clients, reversed dates and adjacent
card data remain unresolved rather than being inferred.

The completeness audit now also treats a nonempty but invalid employment or
project array as missing extraction when the source visibly contains that
section. Placeholder rows can no longer hide a parser gap.

## Same-population private result

The read-only comparison used the same 905 originals and 892 unique byte
contents. Its aggregate population fingerprint matched.

| Aggregate                          | Previous | This parser |        Delta |
| ---------------------------------- | -------: | ----------: | -----------: |
| Complete for validation            |        2 |           3 |           +1 |
| Valid employment rows              |     1788 |        1788 |            0 |
| Valid project rows                 |      511 |         528 |          +17 |
| Missing valid project history      |      660 |         660 |            0 |
| Visible project extraction gaps    |      175 |         252 |      +77 net |
| Visible employment extraction gaps |      148 |         165 | +17 detected |
| PDF requiring OCR                  |       14 |          14 |            0 |
| PDF employment layout unresolved   |       60 |          60 |            0 |
| Source failures                    |        0 |           0 |            0 |

The recovered rows make one additional profile complete for validation and
resolve two visible project gaps. At the same time, the stricter audit exposes
79 project and 17 employment gaps that invalid placeholder rows previously
hid, for a net increase of 77 and 17. Those profiles were already incomplete;
the change now reports them honestly. Counts are structural extraction checks,
not field-level accuracy evidence.

No production database, Storage object or candidate record changed. Bulk
upload and replacing existing profiles remain blocked until current isolated
restore evidence, private Storage/RLS, authenticated synthetic upload/OCR and
readback, and reviewed accuracy evidence are complete. The archive also remains
at least 78 distinct originals short of a 970-unique-file release audit.
