-- Seed demo documents so the Documents vault is not empty.
-- Creates realistic passports, work permits, safety certificates and medical reports
-- for a mix of active workers and staff, with varied expiry dates.

DO $$
DECLARE
  today date := current_date;
BEGIN
  -- Worker 1: Md Rakib Hossain (BS-03) — valid docs
  INSERT INTO public.employee_documents (employee_id, doc_type, name, doc_number, issue_date, expiry_date, issuing_authority, status, reminder_days, verified, version, remarks)
  VALUES
    ('abfd7018-042c-4c5f-b0fc-85c570b4c238', 'Passport', 'Passport', 'E1234567A', today - interval '2 years', today + interval '3 years', 'Bangladesh Government', 'Valid', 60, true, 1, 'Original scan uploaded'),
    ('abfd7018-042c-4c5f-b0fc-85c570b4c238', 'Work Permit', 'Work Permit', 'WP-2025-88321', today - interval '6 months', today + interval '18 months', 'MOM', 'Valid', 60, true, 1, 'Valid for construction sector'),
    ('abfd7018-042c-4c5f-b0fc-85c570b4c238', 'Safety Certificate', 'Safety Orientation Certificate', 'SOC-1129', today - interval '1 year', today + interval '2 years', 'WSH Council', 'Valid', 60, true, 1, 'CSOC certified');

  -- Worker 2: Ramesh Subramaniam (BS-04) — expiring soon
  INSERT INTO public.employee_documents (employee_id, doc_type, name, doc_number, issue_date, expiry_date, issuing_authority, status, reminder_days, verified, version, remarks)
  VALUES
    ('ac5acf5c-7a15-4c73-ad70-7ae1ea2f37b9', 'Passport', 'Passport', 'P9876543B', today - interval '4 years', today + interval '2 years', 'Indian Government', 'Valid', 60, true, 1, 'Clear scan'),
    ('ac5acf5c-7a15-4c73-ad70-7ae1ea2f37b9', 'Work Permit', 'Work Permit', 'WP-2025-99102', today - interval '11 months', today + interval '45 days', 'MOM', 'Expiring Soon', 60, true, 1, 'Renewal application pending'),
    ('ac5acf5c-7a15-4c73-ad70-7ae1ea2f37b9', 'Safety Certificate', 'Work at Height Certificate', 'WAH-2044', today - interval '8 months', today + interval '4 months', 'WSH Council', 'Expiring Soon', 60, false, 1, 'Needs refresher');

  -- Worker 3: Mohammad Ripon Mia (BS-05) — expired work permit
  INSERT INTO public.employee_documents (employee_id, doc_type, name, doc_number, issue_date, expiry_date, issuing_authority, status, reminder_days, verified, version, remarks)
  VALUES
    ('0eca7123-fa22-4300-92f6-194604c79998', 'Passport', 'Passport', 'K1122334C', today - interval '1 year', today + interval '5 years', 'Bangladesh Government', 'Valid', 60, true, 1, ''),
    ('0eca7123-fa22-4300-92f6-194604c79998', 'Work Permit', 'Work Permit', 'WP-2024-44561', today - interval '13 months', today - interval '15 days', 'MOM', 'Expired', 60, false, 1, 'Urgent renewal or repatriation'),
    ('0eca7123-fa22-4300-92f6-194604c79998', 'Medical Report', 'Medical Examination', 'MED-2024-889', today - interval '14 months', today - interval '2 months', 'Approved Clinic', 'Expired', 60, false, 1, 'Needs re-medical');

  -- Staff 1: Anitha Sundaram (1000) — staff docs
  INSERT INTO public.employee_documents (employee_id, doc_type, name, doc_number, issue_date, expiry_date, issuing_authority, status, reminder_days, verified, version, remarks)
  VALUES
    ('ab6f4b2d-888a-4f88-92a6-a590083c737b', 'IC', 'Singapore NRIC', 'S1234567D', null, null, 'ICA', 'Valid', 60, true, 1, 'Local staff'),
    ('ab6f4b2d-888a-4f88-92a6-a590083c737b', 'Employment Pass', 'Employment Pass', 'EP-2025-7712', today - interval '8 months', today + interval '16 months', 'MOM', 'Valid', 60, true, 1, 'Accountant');

  -- Staff 2: Kamrul Hossain (1001) — expiring soon
  INSERT INTO public.employee_documents (employee_id, doc_type, name, doc_number, issue_date, expiry_date, issuing_authority, status, reminder_days, verified, version, remarks)
  VALUES
    ('5fcdf4af-1329-4740-9b74-804486b7bf77', 'Passport', 'Passport', 'E9988771E', today - interval '3 years', today + interval '1 year', 'Bangladesh Government', 'Valid', 60, true, 1, ''),
    ('5fcdf4af-1329-4740-9b74-804486b7bf77', 'Employment Pass', 'Employment Pass', 'EP-2025-3309', today - interval '10 months', today + interval '60 days', 'MOM', 'Expiring Soon', 60, true, 1, 'Renewal initiated');

  -- Worker 4: Habibur Ahmed (BS-27) — valid
  INSERT INTO public.employee_documents (employee_id, doc_type, name, doc_number, issue_date, expiry_date, issuing_authority, status, reminder_days, verified, version, remarks)
  VALUES
    ('5542f08c-d081-493f-b8af-7c05ace028f6', 'Passport', 'Passport', 'E5544332F', today - interval '2 years', today + interval '3 years', 'Bangladesh Government', 'Valid', 60, true, 1, ''),
    ('5542f08c-d081-493f-b8af-7c05ace028f6', 'Work Permit', 'Work Permit', 'WP-2025-55412', today - interval '4 months', today + interval '20 months', 'MOM', 'Valid', 60, true, 1, ''),
    ('5542f08c-d081-493f-b8af-7c05ace028f6', 'Safety Certificate', 'CSOC', 'CSOC-7781', today - interval '6 months', today + interval '18 months', 'WSH Council', 'Valid', 60, true, 1, 'Active');

  -- Worker 5: Goh Mei Ling (BS-28) — expired passport
  INSERT INTO public.employee_documents (employee_id, doc_type, name, doc_number, issue_date, expiry_date, issuing_authority, status, reminder_days, verified, version, remarks)
  VALUES
    ('afaf5fcc-5134-4778-bb95-542e30ed0460', 'Passport', 'Passport', 'P3322110G', today - interval '8 years', today - interval '30 days', 'Malaysian Government', 'Expired', 60, false, 1, 'Employee must renew passport'),
    ('afaf5fcc-5134-4778-bb95-542e30ed0460', 'Work Permit', 'Work Permit', 'WP-2025-22008', today - interval '3 months', today + interval '21 months', 'MOM', 'Valid', 60, true, 1, 'Valid until renewal issue resolved');

END $$;
