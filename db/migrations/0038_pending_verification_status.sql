-- Self-service profile submission moves an employee to "Pending Verification".
-- The enum was missing this value, which made enforce_employee_self_update()
-- raise on every non-staff update.
alter type employee_status add value if not exists 'Pending Verification' after 'Pending Profile Completion';
