# Precision v169: count split employer labels in coverage

The shared completeness gate counted explicitly labelled employers only when
the company value appeared after a colon on the same line. A CV can place the
company on the next line, including after `Company Name` without a colon. If
only one of two such jobs was parsed, the gate could mistakenly regard the
observed employment section as fully extracted.

The gate now counts employer labels followed by a nonempty value within two
blank lines inside the bounded employment section. A following field label
does not count as a company value. Labels in a later project section cannot
inflate the employment count. Fewer valid structured jobs than source anchors
keeps the profile in review for both admin and candidate uploads; it never
creates a new job or employer from uncertain text.

Synthetic regressions cover two split labels, an empty company field and a
later project company. The offline audit is read-only and keeps originals
private. On the same 905 originals (892 unique contents), the gate marked eight
more employment sections as incompletely extracted (160 to 168). All eight
were already in review: four automatically complete profiles, 779 review
profiles, 44 unresolved PDF layouts and 15 OCR-required PDFs were unchanged.
There were no source failures. Automated completeness remains a validation
queue, not proof that every field matches the source CV. Production bulk upload
still depends on an isolated restore, access control and authenticated provider
readback.

After combining this gate with the preceding bounded Word employment-card
reader, a second full-population audit found 1,859 valid employment rows
(1,841 at v167), 165 employment sections missed (160 at v167), 560 project
rows and the same four automatically complete profiles. The two changes
interact, so these combined deltas are not attributed to this gate alone.
