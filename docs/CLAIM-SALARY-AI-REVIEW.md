# Automatic claim and salary recheck

- Claim Summary and Combined Claim share a screen-only automatic review; Salary Sheet reviews its filtered saved-payroll rows separately.
- The existing AI Brain endpoint and staff authorization are reused. No new provider, privileged browser access, storage or database writes are added.
- Reviews receive detached identity, claim totals/project breakdowns or saved salary fields. They do not receive original files or mutable workbooks, and cannot verify source-card dates or certify complete payroll.
- Every visible record is reviewed in batches of 40 with at most two requests at once. Search changes wait 750 ms; current results are held only in the existing in-memory query client, keyed by user and exact input. No persistent/offline AI review cache is introduced.
- Missing/duplicate identities, unresolved payroll and invalid values are flagged locally; AI adds evidence-supported advisory findings. No fixed hours limit or new payroll formula is introduced.
- Failed, empty or truncated responses are not marked successful. Review failure does not disable original downloads; existing payroll completeness restrictions still apply.
- Export functions are unchanged and never consume AI output. No added worksheets, columns, summaries, formulas or altered formats.

## Verification

25 November 2026: 54 focused tests pass across review, workflow, filtering, claim aggregation, template expansion and AI Brain forwarding. Controlled populated UI checks pass at 1206 × 626 and 390 × 844: automatic requests, identical-input reuse, changed salary data, explicit failure state, no overflow or page errors. A real provider request using fictional salary data returned HTTP 200 and identified unprepared payroll/missing net pay.

Real signed-in review and downloaded-file read-back remain unverified: this project uses external authentication and no authorized sandbox session is available. The real `/claim-workflow` route redirects to `/auth`. No operational test records were created or changed.