# Account permissions deployment

The website now uses shared fail-closed route permissions. Self-signup no longer provisions employee records or assigns employee access. Role-less accounts render a welcome-only page without loading the shared company store.

## External database update required

This project uses an external Supabase database. The available service-role key supports user administration and data requests, not schema SQL execution. These SQL files are staged, **not applied**:

1. Run `db/migrations/0067_account_role_values.sql` and commit.
2. Run `db/migrations/0068_account_access.sql` separately.
3. Verify signup creates no role, role updates through `set_user_role` work as admin and fail for non-admins, and role-less reads return no company records.

Until these are applied, Driver, Accounts and IT cannot be saved in the database, and role assignments display a configuration error instead of deleting an existing role.

The restrictive role-required policies deny role-less access but do not replace an audit of all existing domain policies. In particular, assigned-role data boundaries still require review of existing broad authenticated policies before claiming production-wide least privilege.

## Website permissions

- Admin: full access and role assignment.
- HR: workforce, attendance, recruitment and payroll.
- Manager: operations, clients, deployments and finance.
- Supervisor: site/workforce operations.
- Driver: own attendance and payslips through My Portal; group dispatch management is not granted.
- Accounts: billing, contracts, finance and payroll, not workforce administration.
- IT: audit logs and own portal; account administration remains admin-only.
- Ordinary signup: welcome-only access.

No existing user is automatically demoted by these changes.