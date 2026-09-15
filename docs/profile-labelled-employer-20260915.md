# Labelled employer recovery

Partial recovery; production acceptance is not complete.

Recover explicit Employer or employment-section Company Name blocks with Position/Designation/Job Title and dates. Stop before client/project blocks so assignment dates cannot become employment tenure. Separate metadata such as industry, website, salary and parent company from employer/title fields. Narrative job-role descriptions remain responsibilities with an unknown title.

Selected 277-source regression population, v85 -> v86:
- Profiles with employment: 13 -> 25.
- Employment records: 37 -> 116.
- Profiles without extracted employment: 264 -> 252.
- Records with title: 33 -> 86; missing titles are not manufactured.
- Records with date range: 36 -> 115.
- Projects: 48 -> 48.

This export is a selected review population, not all 970 records. Completeness is not independently verified accuracy. Scoring rules are unchanged but full-population score distribution has not been measured. No source CVs are committed and no database records are modified.

Tests cover metadata isolation, consecutive employers, project date isolation and narrative roles. Authenticated production UI and broader source formats remain outstanding.
