-- ============================================================
-- Migration: Zones & Devices hierarchy
-- Each site has Zones (HVAC Room, Electrical Room, etc.)
-- Each Zone has Devices (HVAC Unit 1, HVAC Unit 2, etc.)
-- Each Zone owns a form template (all devices share the zone form)
-- Each Device gets its own QR code: /collect?site=<id>&device=<id>
-- ============================================================

-- 1. Zones within a site (the tiles shown to workers)
CREATE TABLE IF NOT EXISTS site_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT 'zap',
  form_template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL,
  sort_order      INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Individual devices within a zone
CREATE TABLE IF NOT EXISTS site_devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     UUID NOT NULL REFERENCES site_zones(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  device_code TEXT,
  active      BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add zone/device tracking to entries
ALTER TABLE entries ADD COLUMN IF NOT EXISTS zone_id   UUID REFERENCES site_zones(id);
ALTER TABLE entries ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES site_devices(id);

-- 4. RLS for site_zones
ALTER TABLE site_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active zones"
  ON site_zones FOR SELECT USING (active = true);

CREATE POLICY "Authenticated manage zones"
  ON site_zones FOR ALL USING (auth.role() = 'authenticated');

-- 5. RLS for site_devices
ALTER TABLE site_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active devices"
  ON site_devices FOR SELECT USING (active = true);

CREATE POLICY "Authenticated manage devices"
  ON site_devices FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- Seed: Default zones for existing site (Substation A - Gachibowli)
-- ============================================================
DO $$
DECLARE
  v_site_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_template_id UUID;
  v_hvac_zone_id UUID;
  v_elec_zone_id UUID;
  v_batt_zone_id UUID;
BEGIN
  -- Get the default template id
  SELECT id INTO v_template_id FROM form_templates LIMIT 1;

  -- HVAC Zone
  INSERT INTO site_zones (site_id, name, icon, form_template_id, sort_order)
  VALUES (v_site_id, 'HVAC Room', 'wind', v_template_id, 1)
  RETURNING id INTO v_hvac_zone_id;

  INSERT INTO site_devices (zone_id, site_id, name, device_code, sort_order) VALUES
    (v_hvac_zone_id, v_site_id, 'HVAC Unit 1', 'HVAC-01', 1),
    (v_hvac_zone_id, v_site_id, 'HVAC Unit 2', 'HVAC-02', 2),
    (v_hvac_zone_id, v_site_id, 'HVAC Unit 3', 'HVAC-03', 3);

  -- Electrical Room Zone
  INSERT INTO site_zones (site_id, name, icon, form_template_id, sort_order)
  VALUES (v_site_id, 'Electrical Room', 'zap', v_template_id, 2)
  RETURNING id INTO v_elec_zone_id;

  INSERT INTO site_devices (zone_id, site_id, name, device_code, sort_order) VALUES
    (v_elec_zone_id, v_site_id, 'Panel A', 'ELEC-01', 1),
    (v_elec_zone_id, v_site_id, 'Panel B', 'ELEC-02', 2),
    (v_elec_zone_id, v_site_id, 'MCC Board', 'ELEC-03', 3);

  -- Battery Room Zone
  INSERT INTO site_zones (site_id, name, icon, form_template_id, sort_order)
  VALUES (v_site_id, 'Battery Room', 'battery', v_template_id, 3)
  RETURNING id INTO v_batt_zone_id;

  INSERT INTO site_devices (zone_id, site_id, name, device_code, sort_order) VALUES
    (v_batt_zone_id, v_site_id, 'Battery Bank 1', 'BATT-01', 1),
    (v_batt_zone_id, v_site_id, 'Battery Bank 2', 'BATT-02', 2);
END $$;
