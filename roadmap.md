# Role-based account access
- [ ] Provide provisional Excel bulk-upload templates and Excel export for Staff Directory, Staff Attendance and Staff Payroll; finalize bulk saving after the user's updated workbook arrives.
- [x] Restrict ordinary signup accounts to a welcome-only dashboard without business data loading.
- [ ] Activate admin role assignment for HR, manager, driver, accounts and IT: blocked on applying staged external database SQL (new role values and atomic assignment RPC).
- [ ] Enforce database-wide unprivileged signup and role access: blocked on external database SQL execution access and reviewing deployed domain policies; relevant signup/assistant/mobile API guards are implemented.
- [x] Test access rules (8 passing tests) and verify real role-less sign-in: welcome-only, restricted deep-link redirect, no company data requests; temporary account deleted.