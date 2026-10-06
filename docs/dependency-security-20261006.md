# Dependency security repair — 6 October 2026

Foundation CI exposed dependency audit failures and acceptance formatting failures
that the separate immutable Action reference check does not cover.

The repair updates `source-map-js` to 1.2.2 and replaces the Tailwind 3 build
dependency chain with pinned Tailwind/PostCSS 4.3.3. The upstream migration tool
renames utility classes; a TypeScript AST comparison confirms the 71 changed
components retain their structure and only string/template class contents change.
Source discovery remains limited to `app` and `components`. The reviewed v3 color
palette and default border, ring, placeholder, button cursor and dialog margins
are retained explicitly in CSS. Tailwind 4 requires modern browsers (Safari 16.4+,
Chrome 111+ and Firefox 128+).

Mammoth remains at 1.12.3. A scoped override moves its CLI-only `argparse`
dependency to 2.0.1, which retains the legacy API Mammoth uses and removes
`sprintf-js`. A synthetic DOCX regression exercises extraction with line breaks
and tabs, HTML through API and CLI, output files, invalid choices and mutually
exclusive arguments. A CSS compiler regression covers palette values, card
geometry, comparison grids, disabled controls and keyboard focus. Both run in
Foundation CI; audit severity and existing security gates are unchanged.

Local verification: dependency audit reports zero vulnerabilities; manifest/lock
and license inventory pass; TypeScript and Webpack production build pass; PDF
font traces and the client bundle secret scan pass (316 files, zero hits).
Authorization, acceptance safety/cleanup, Search V2, canonical employment,
parser/OCR and dependency regressions pass. Acceptance formatting was repaired
without changing behavior.

Visual validation is still required on a supported preview before release.
The local browser check could not run: the packaged browser would not start,
and opening the generated `file://` sample in the cloud browser was rejected by
its URL policy. The blocked browser action was stopped. Compiler/AST checks do
not establish pixel parity. PR stays draft, external/portal flags stay off, and
actual production is unchanged. No new authenticated acceptance run was started
for this repair.

The older `visualPolish.test.ts` also reports a legacy navigation expectation;
its route tokens are unchanged by this repair. It is not part of the Foundation
workflow, and is not claimed as passing here.
