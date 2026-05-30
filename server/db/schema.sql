CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT,
  governorate TEXT,
  area TEXT,
  address TEXT,
  phone TEXT,
  status TEXT,
  slug TEXT,
  access_code TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  clinic_type TEXT,
  plan TEXT,
  subscription_status TEXT,
  registration_status TEXT,
  trial_ends_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  whatsapp_booking_enabled BOOLEAN,
  whatsapp_sender_phone TEXT,
  whatsapp_delivery_mode TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clinic_id TEXT,
  auth_user_id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  password_hash TEXT,
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  clinic_id TEXT,
  name TEXT,
  specialty TEXT,
  bio TEXT,
  fee INTEGER,
  gender TEXT,
  status TEXT,
  rating NUMERIC,
  average_waiting_time TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  doctor_id TEXT,
  day_of_week TEXT,
  start_time TEXT,
  end_time TEXT,
  max_patients INTEGER,
  average_consultation_minutes INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  booking_code TEXT,
  clinic_id TEXT,
  doctor_id TEXT,
  patient_name TEXT,
  patient_phone TEXT,
  patient_age INTEGER,
  patient_gender TEXT,
  visit_reason TEXT,
  booking_date DATE,
  approximate_time TEXT,
  time_block TEXT,
  queue_number INTEGER,
  status TEXT,
  current_queue_snapshot INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS queue_sessions (
  id TEXT PRIMARY KEY,
  clinic_id TEXT,
  doctor_id TEXT,
  date DATE,
  current_queue_number INTEGER,
  status TEXT,
  delay_message TEXT,
  delay_reason TEXT,
  delay_duration_minutes INTEGER,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  clinic_id TEXT,
  plan TEXT,
  status TEXT,
  started_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  seats INTEGER,
  price_iqd INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  clinic_id TEXT,
  type TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS specialties (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS governorates (
  id TEXT PRIMARY KEY,
  name TEXT,
  areas JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS clinics_slug_idx ON clinics (slug);
CREATE INDEX IF NOT EXISTS users_clinic_idx ON users (clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_idx ON users (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS doctors_clinic_idx ON doctors (clinic_id);
CREATE INDEX IF NOT EXISTS schedules_doctor_idx ON schedules (doctor_id);
CREATE INDEX IF NOT EXISTS bookings_clinic_idx ON bookings (clinic_id);
CREATE INDEX IF NOT EXISTS bookings_doctor_date_idx ON bookings (doctor_id, booking_date);
CREATE INDEX IF NOT EXISTS bookings_phone_idx ON bookings (patient_phone);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_code_idx ON bookings (booking_code);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_active_phone_idx
  ON bookings (doctor_id, booking_date, patient_phone)
  WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS queue_sessions_clinic_idx ON queue_sessions (clinic_id);
CREATE INDEX IF NOT EXISTS queue_sessions_doctor_date_idx ON queue_sessions (doctor_id, date);
CREATE INDEX IF NOT EXISTS notifications_clinic_idx ON notifications (clinic_id);
CREATE INDEX IF NOT EXISTS subscriptions_clinic_idx ON subscriptions (clinic_id);
