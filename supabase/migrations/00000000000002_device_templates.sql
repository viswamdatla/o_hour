-- Migration: Add per-device form template override
-- If a device has its own form_template_id, that takes priority over the zone's template.

ALTER TABLE site_devices
  ADD COLUMN IF NOT EXISTS form_template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL;
