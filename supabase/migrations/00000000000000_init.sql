-- Create tables
CREATE TABLE IF NOT EXISTS public.form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    site_code TEXT UNIQUE NOT NULL,
    address TEXT,
    form_template_id UUID REFERENCES public.form_templates(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    required BOOLEAN DEFAULT TRUE,
    section_name TEXT,
    sort_order INTEGER NOT NULL,
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    worker_phone TEXT NOT NULL,
    form_template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
    field_values JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    reading_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.otp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT,
    otp_code TEXT NOT NULL,
    type TEXT NOT NULL, -- 'worker' or 'site_confirm'
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    entry_id UUID REFERENCES public.entries(id) ON DELETE CASCADE,
    verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on RLS and create basic policies
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_sessions ENABLE ROW LEVEL SECURITY;

-- FOR THIS APP: 
-- Production RLS Policies
-- Public (Anon) can read configuration data to render forms and verify data.
-- Authenticated admins can manage everything.

-- 1. Read Policies
CREATE POLICY "Allow public read access to form_templates" ON public.form_templates FOR SELECT USING (true);
CREATE POLICY "Allow public read access to sites" ON public.sites FOR SELECT USING (true);
CREATE POLICY "Allow public read access to workers" ON public.workers FOR SELECT USING (true);
CREATE POLICY "Allow public read access to form_fields" ON public.form_fields FOR SELECT USING (true);

-- Entries: Public needs read for realtime updates, Admins have full access
CREATE POLICY "Allow public read access to entries" ON public.entries FOR SELECT USING (true);
CREATE POLICY "Allow public read access to otp_sessions" ON public.otp_sessions FOR SELECT USING (true);

-- 2. Write Policies - Admin Only (Authenticated)
CREATE POLICY "Allow authenticated full access to form_templates" ON public.form_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to sites" ON public.sites FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to workers" ON public.workers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to form_fields" ON public.form_fields FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to entries_admin" ON public.entries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to otp_sessions_admin" ON public.otp_sessions FOR ALL USING (auth.role() = 'authenticated');

-- 3. Write Policies - Public (Anon)
-- Workers can insert and update their entries
CREATE POLICY "Allow public insert to entries" ON public.entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to entries" ON public.entries FOR UPDATE USING (true);

-- Workers can create and update OTP sessions for verification
CREATE POLICY "Allow public insert to otp_sessions" ON public.otp_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to otp_sessions" ON public.otp_sessions FOR UPDATE USING (true);

-- SEED DATA
-- Insert Form Templates
INSERT INTO public.form_templates (id, name) VALUES 
('11111111-1111-1111-1111-111111111111', 'Electrical O-Hour Reading'),
('22222222-2222-2222-2222-222222222222', 'Site Inspection Checklist');

-- Insert Sites
INSERT INTO public.sites (id, name, site_code, address, form_template_id) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Substation A - Gachibowli', 'HYD-SUB-001', 'Gachibowli, Hyderabad', '11111111-1111-1111-1111-111111111111'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Feeder Panel - Madhapur', 'HYD-FDR-002', 'Madhapur, Hyderabad', '11111111-1111-1111-1111-111111111111'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Distribution Box - Kondapur', 'HYD-DBX-003', 'Kondapur, Hyderabad', '11111111-1111-1111-1111-111111111111');

-- Insert Workers
INSERT INTO public.workers (name, phone) VALUES 
('Ravi Kumar', '9876543210'),
('Suresh Babu', '9123456789');

-- Insert Form Fields for Template 1
INSERT INTO public.form_fields (form_template_id, label, field_type, required, sort_order, config) VALUES 
('11111111-1111-1111-1111-111111111111', 'R Phase Voltage', 'number', true, 1, '{"unit": "V"}'),
('11111111-1111-1111-1111-111111111111', 'Y Phase Voltage', 'number', true, 2, '{"unit": "V"}'),
('11111111-1111-1111-1111-111111111111', 'B Phase Voltage', 'number', true, 3, '{"unit": "V"}'),
('11111111-1111-1111-1111-111111111111', 'R Phase Current', 'number', true, 4, '{"unit": "A"}'),
('11111111-1111-1111-1111-111111111111', 'Y Phase Current', 'number', true, 5, '{"unit": "A"}'),
('11111111-1111-1111-1111-111111111111', 'B Phase Current', 'number', true, 6, '{"unit": "A"}'),
('11111111-1111-1111-1111-111111111111', 'Active Power', 'number', true, 7, '{"unit": "kW"}'),
('11111111-1111-1111-1111-111111111111', 'Power Factor', 'number', true, 8, '{"min": 0, "max": 1}'),
('11111111-1111-1111-1111-111111111111', 'Frequency', 'number', true, 9, '{"unit": "Hz"}'),
('11111111-1111-1111-1111-111111111111', 'Energy Reading', 'number', true, 10, '{"unit": "kWh"}'),
('11111111-1111-1111-1111-111111111111', 'Transformer Temp', 'number', false, 11, '{"unit": "°C"}'),
('11111111-1111-1111-1111-111111111111', 'Remarks', 'textarea', false, 12, '{}');

-- Insert Form Fields for Template 2
INSERT INTO public.form_fields (form_template_id, label, field_type, required, sort_order, config) VALUES 
('22222222-2222-2222-2222-222222222222', 'Inspector Name', 'text', true, 1, '{}'),
('22222222-2222-2222-2222-222222222222', 'Equipment Condition', 'select', true, 2, '{"options": ["Good", "Fair", "Poor"]}'),
('22222222-2222-2222-2222-222222222222', 'Safety Gear Worn', 'checkbox', true, 3, '{}'),
('22222222-2222-2222-2222-222222222222', 'Issues Found', 'textarea', false, 4, '{}'),
('22222222-2222-2222-2222-222222222222', 'Next Inspection Date', 'date', true, 5, '{}');
