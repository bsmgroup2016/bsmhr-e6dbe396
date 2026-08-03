-- Migration: Add Dormitory Invoicing, Inspection Logs, and Movement History Tables

-- 1. Dormitory Invoicing
CREATE TABLE IF NOT EXISTS public.dormitory_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    dormitory_id UUID REFERENCES public.dormitories(id) ON DELETE CASCADE,
    invoice_no TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    total_amount NUMERIC(12,2) DEFAULT 0,
    amount_paid NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'Draft', -- Draft, Pending, Paid, Overdue
    document_url TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Inspection Logs
CREATE TABLE IF NOT EXISTS public.dormitory_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dormitory_id UUID REFERENCES public.dormitories(id) ON DELETE CASCADE,
    inspection_date DATE NOT NULL,
    inspector_name TEXT,
    findings TEXT,
    document_urls TEXT[], -- Store multiple photos
    status TEXT DEFAULT 'Passed', -- Passed, Failed, Needs Rectification
    rectification_deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Dormitory Movement History
CREATE TABLE IF NOT EXISTS public.dormitory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    from_dormitory_id UUID REFERENCES public.dormitories(id),
    to_dormitory_id UUID REFERENCES public.dormitories(id),
    from_room TEXT,
    to_room TEXT,
    move_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dormitory_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dormitory_inspections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dormitory_movements TO authenticated;

-- RLS
ALTER TABLE public.dormitory_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dormitory_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dormitory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users" ON public.dormitory_invoices FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.dormitory_inspections FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON public.dormitory_movements FOR ALL TO authenticated USING (true);
