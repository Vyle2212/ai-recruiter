# Manual App UI Check Guide v1

This guide is a repeatable, read-only walkthrough for checking the recruiter experience before visual-polish work begins. Do not use any apply, merge, reupload, delete, email, or write workflow while following it.

## 1. Start the app locally

Run:

```bash
npm run dev
```

Open `http://localhost:3000`. Keep the terminal visible and note any compile or runtime errors. If port 3000 is already in use, stop the other local process or start this app on another port:

```bash
npm run dev -- -p 3001
```

Then open `http://localhost:3001`. Generate concrete sample links before starting:

```bash
npm run print:ui-check-routes
```

## 2. Required pre-checks

Run these commands and resolve failures before the visual walkthrough:

```bash
npm run typecheck
npm run test
npm run audit:ui-routes
npm run audit:product-health
npm run audit:smart-shortlist
npm run audit:candidate360
npm run audit:candidate-compare
npm run audit:submission-generator
npm run audit:client-report
```

Expected baseline: 970 total candidates, 277 ready for shortlist, route audit passed, product health healthy, zero unsafe routes, zero candidate DB writes, and zero OpenAI calls.

## 3. Page-by-page checks

Use the concrete candidate and selection URLs printed by `npm run print:ui-check-routes` for dynamic pages.

### Recruiter Dashboard � `/recruiter/dashboard`

- Purpose: recruiter command center and entry point to every major feature.
- Expect: KPI cards, workflow status, recruiter tools, recommended flow, safety policy, Product Health, Manual UI Check commands, and milestones.
- Links/buttons: Workflow, Smart Shortlist, Compare, Submission Generator, Client Report, Import Staging, and Import Merge.
- Must not happen: no data changes when opening cards or navigating.
- Read-only limitation: health information reflects generated local reports and can be stale until audits run.
- Look for: clipped KPI values, uneven cards, weak hierarchy, command text wrapping, loading/error feedback, and mobile overflow.
- Checklist: [ ] loads [ ] KPIs visible [ ] all feature links work [ ] safety status visible [ ] commands readable [ ] no write action

### Recruiter Workflow � `/recruiter/workflow`

- Purpose: operational workflow and audit view, distinct from the dashboard command center.
- Expect: workflow counts/status, audit-oriented information, and entry links to recruiter tools.
- Links/buttons: Dashboard, Smart Shortlist, Candidate360 entry path, Compare, Submission, Client Report, Import Staging, and Import Merge.
- Must not happen: no workflow state changes or quick-fix apply.
- Read-only limitation: this check does not exercise apply actions.
- Look for: dense tables, unclear status labels, horizontal overflow, and whether Dashboard versus Workflow is understandable.
- Checklist: [ ] loads [ ] counts render [ ] navigation works [ ] operational purpose is clear [ ] no enabled apply action

### Smart Shortlist � `/recruiter/smart-shortlist`

- Purpose: browse the `ready_for_shortlist` population and select 2�5 candidates.
- Expect: 277-card baseline, filters, sorting, stats, ready-only label, selection panel, and missing-field warnings.
- Links/buttons: Candidate360, self-confirm preview, Generate Submission, Compare Selected, and Create Client Report.
- Must not happen: needs-repair candidates must not appear by default; selection must not persist to the DB.
- Read-only limitation: compare/report actions only prepare URLs and previews.
- Look for: card/table scanability, filter spacing, selection feedback, disabled-action explanation, badge consistency, and narrow-screen overflow.
- Checklist: [ ] loads [ ] ready-only label visible [ ] filters work [ ] 2�5 selection works [ ] links preserve IDs [ ] no write action

### Candidate360 � `/recruiter/candidate360/<sampleCandidateId>`

- Purpose: inspect the complete candidate snapshot, source trust, verification, completeness, and missing data.
- Expect: header, executive summary, trust panel, core fields, experience, skills/modules, missing fields, and recruiter actions.
- Links/buttons: Workflow/Smart Shortlist, self-confirm preview, Compare Candidate, and Generate Submission.
- Must not happen: no candidate field is edited or saved.
- Read-only limitation: shortlist/submission actions are preview or navigation only.
- Look for: graceful empty fields, long evidence wrapping, badge colors, section rhythm, suspicious values shown as warnings, and mobile stacking.
- Checklist: [ ] loads [ ] identity visible [ ] sources/statuses visible [ ] missing fields explicit [ ] actions link correctly [ ] no save/delete

### Self-confirm Preview � `/candidate/self-confirm/<sampleCandidateId>`

- Purpose: preview how a candidate could review and correct their profile.
- Expect: preview-only banner, personal/contact/current-role/experience/skills sections, confirmation checkbox, before/after preview, and completeness change.
- Links/buttons: Preview Changes only; navigation back where available.
- Must not happen: no final profile save or candidate DB update.
- Read-only limitation: confirmation and edits exist only in the generated preview.
- Look for: unmistakable preview messaging, clear before/after differences, recruiter-review warnings, form grouping, and small-screen usability.
- Checklist: [ ] loads [ ] preview banner visible [ ] fields editable locally [ ] preview renders [ ] review warning appears on conflicts [ ] no submit write

### Candidate Compare � `/recruiter/candidate-compare`

- Purpose: compare 2�5 Candidate360 profiles against role requirements deterministically.
- Expect: role form, selected IDs, validation, ranked results, dimensions, strengths, gaps, risks, evidence, and missing information.
- Links/buttons: Smart Shortlist, Candidate360, Submission Generator, and Client Report.
- Must not happen: no OpenAI request, workflow update, or profile write.
- Read-only limitation: results are local deterministic previews and are not persisted.
- Look for: form density, score readability, ranking hierarchy, evidence length, error states for fewer than 2/more than 5 IDs, and responsive tables.
- Checklist: [ ] sample IDs load [ ] 2�5 validation works [ ] compare runs [ ] ranking clear [ ] evidence grounded [ ] no persistence

### Submission Generator � `/recruiter/submission-generator`

- Purpose: create an editable candidate submission draft from Candidate360 facts.
- Expect: deterministic/read-only badges, candidate summary, role/client context, format selector, draft sections, evidence, missing info, warnings, and email preview.
- Links/buttons: Candidate360, Smart Shortlist, Candidate Compare, Client Report, Generate Draft, and copy-only actions.
- Must not happen: no email is sent and no draft/profile is stored.
- Read-only limitation: copy actions affect only the clipboard; generated text is a preview.
- Look for: long draft readability, copy affordances, missing-context state, safety banner prominence, and content overclaiming.
- Checklist: [ ] candidate loads [ ] draft generates [ ] missing data labeled [ ] safety banner visible [ ] links work [ ] email sends remain zero

### Client Executive Report � `/recruiter/client-report`

- Purpose: generate a client-ready shortlist preview for 2�5 candidates.
- Expect: client/role form, candidate cards, executive summary, ranking, comparison matrix, candidate highlights, risks, missing info, next steps, and email brief.
- Links/buttons: Smart Shortlist, Candidate Compare, Candidate360/Submission links, Generate Report, and copy-only actions.
- Must not happen: no report persistence, email sending, or candidate/workflow write.
- Read-only limitation: no PDF or final client submission in v1.
- Look for: table overflow, ranking clarity, repeated content, long text hierarchy, candidate differentiation, and responsive behavior.
- Checklist: [ ] 2�5 validation works [ ] report generates [ ] matrix readable [ ] missing info present [ ] copy controls clear [ ] no send/save

### Import Staging � `/recruiter/import-staging`

- Purpose: review imported/reuploaded data in staging before any main-profile merge.
- Expect: batch summary, match statuses, new candidates, duplicate risks, conflicts, blocked generic values, and recommendations.
- Links/buttons: Dashboard/Workflow navigation and preview/filter controls; merge must be absent or disabled.
- Must not happen: no direct main DB reupload, candidate creation, or merge apply.
- Read-only limitation: current UI reads staged reports and previews only.
- Look for: risk visibility, status/filter clarity, large-table scanning, generic-value warnings, and disabled action explanation.
- Checklist: [ ] loads [ ] match groups visible [ ] conflicts clear [ ] generic values blocked [ ] merge disabled [ ] no upload-to-main action

### Import Merge Approval � `/recruiter/import-merge`

- Purpose: inspect field-level merge proposals and trust conflicts before a separately guarded apply process.
- Expect: proposal summary, risk/conflict/decision filters, existing-versus-imported trust, decisions as UI state, and preview-only safety messaging.
- Links/buttons: Dashboard/Workflow navigation and preview controls only.
- Must not happen: no real merge apply, candidate overwrite, delete, or rollback.
- Read-only limitation: UI decisions are not persisted and protected fields cannot be overwritten automatically.
- Look for: comparison readability, trust-source distinction, conflict severity, disabled merge clarity, and narrow-screen table behavior.
- Checklist: [ ] loads [ ] trust comparison visible [ ] conflicts obvious [ ] protected values retained [ ] apply unavailable [ ] no write

## 4. Candidate flow checklist

- [ ] Open Smart Shortlist.
- [ ] Select 2�5 candidates and verify the selected count.
- [ ] Open Candidate Compare and generate a deterministic comparison.
- [ ] Open Submission Generator for one ranked candidate and generate a draft.
- [ ] Open Client Report with the selected IDs and generate the report preview.
- [ ] Confirm Candidate360 and self-confirm links retain the correct candidate ID.
- [ ] Confirm no candidate/workflow writes, email sends, or persisted submissions occurred.

## 5. Data quality checklist

- [ ] Candidate360 displays missing fields explicitly and without crashing.
- [ ] Self-confirm displays �Preview only. No profile updates are saved yet.�
- [ ] Missing company, title, location, and contact warnings are visible where applicable.
- [ ] Suspicious or generic values are warnings, not asserted facts.
- [ ] Candidate-confirmation and recruiter-review warnings are visible.
- [ ] Generated compare/submission/report content is grounded in displayed evidence.

## 6. Safety checklist

- [ ] No delete buttons are available.
- [ ] No full reupload into the main candidate DB is available.
- [ ] No real merge apply is available from the UI.
- [ ] No email sending is available.
- [ ] No OpenAI usage is triggered.
- [ ] Write/apply controls are disabled, absent, or clearly marked preview-only.
- [ ] Main DB deletion and full reupload remain blocked in Product Health.

## 7. Issue logging template

Copy one block per issue:

```text
Page:
Route:
Steps to reproduce:
1.
2.
3.
Expected behavior:
Actual behavior:
Screenshot filename:
Severity: blocker | high | medium | low
Suggested fix:
```

