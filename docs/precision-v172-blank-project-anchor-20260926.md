# Precision v172: ignore empty project anchors

The project completeness gate counts a Project or Client value on the next
line. A blank `Client` followed by `Role:` or a blank `Project` followed by
`Duration:` was previously counted as an additional assignment. That can
make one correctly parsed project look incomplete for the wrong reason.

The counter now rejects another field label as a next-line value. Synthetic
regressions preserve valid split Project and Client values, require two
structured rows for two real split Clients, and ignore empty labels followed
by other fields. If no valid project exists, the observed project section
still requires review.

The read-only audit on the same 905 original files (892 distinct contents)
did not change the aggregate: four automatically complete profiles, 779
needing review, 251 with observed project evidence not fully extracted, 558
valid project rows, 44 unresolved PDF layouts, 15 OCR-required PDFs and zero
source failures. Thus this fix removes a proven false anchor in the synthetic
case but does not clear a real CV in the supplied collection. It made no
database writes and does not enable bulk upload.
