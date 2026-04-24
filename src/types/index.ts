export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Site {
  id: string;
  name: string;
  site_code: string;
  address: string | null;
  form_template_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  created_at: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  created_at: string;
}

export interface FormField {
  id: string;
  form_template_id: string;
  label: string;
  field_type: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'checkbox' | string;
  required: boolean;
  section_name: string | null;
  sort_order: number;
  config: Record<string, any> | null;
  created_at: string;
}

export interface Entry {
  id: string;
  site_id: string;
  worker_phone: string;
  form_template_id: string;
  field_values: Record<string, any>;
  status: 'pending' | 'confirmed' | string;
  reading_timestamp: string;
  created_at: string;
}

export interface OtpSession {
  id: string;
  phone: string | null;
  otp_code: string;
  type: 'worker' | 'site_confirm';
  site_id: string;
  entry_id: string | null;
  verified: boolean;
  expires_at: string;
  created_at: string;
}
