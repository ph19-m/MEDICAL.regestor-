const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSeedData } = require("./seed");

const SOURCE_DATA_DIR = path.join(__dirname, "..", "data");
const SOURCE_DB_PATH = path.join(SOURCE_DATA_DIR, "db.json");
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "dawri-medical")
  : SOURCE_DATA_DIR;
const DB_PATH = path.join(DATA_DIR, "db.json");

const USE_POSTGRES = Boolean(process.env.DATABASE_URL);
const ALLOW_JSON_FALLBACK =
  process.env.DAWRI_ALLOW_JSON_FALLBACK === "true" ||
  (!process.env.VERCEL && process.env.NODE_ENV !== "production");

const APP_COLLECTIONS = [
  "users",
  "clinics",
  "doctors",
  "schedules",
  "bookings",
  "queueSessions",
  "notifications",
  "subscriptions",
  "specialties",
  "governorates"
];

const COLLECTIONS = {
  users: {
    table: "users",
    fields: {
      clinic_id: "TEXT",
      auth_user_id: "TEXT",
      name: "TEXT",
      phone: "TEXT",
      email: "TEXT",
      password_hash: "TEXT",
      role: "TEXT",
      status: "TEXT",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "created_at ASC NULLS LAST, id ASC"
  },
  clinics: {
    table: "clinics",
    fields: {
      name: "TEXT",
      governorate: "TEXT",
      area: "TEXT",
      address: "TEXT",
      phone: "TEXT",
      status: "TEXT",
      slug: "TEXT",
      access_code: "TEXT",
      owner_name: "TEXT",
      owner_phone: "TEXT",
      clinic_type: "TEXT",
      plan: "TEXT",
      subscription_status: "TEXT",
      registration_status: "TEXT",
      trial_ends_at: "TIMESTAMPTZ",
      approved_at: "TIMESTAMPTZ",
      whatsapp_booking_enabled: "BOOLEAN",
      whatsapp_sender_phone: "TEXT",
      whatsapp_delivery_mode: "TEXT",
      internal_notes: "TEXT",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "created_at ASC NULLS LAST, id ASC"
  },
  doctors: {
    table: "doctors",
    fields: {
      clinic_id: "TEXT",
      name: "TEXT",
      specialty: "TEXT",
      bio: "TEXT",
      fee: "INTEGER",
      gender: "TEXT",
      status: "TEXT",
      rating: "NUMERIC",
      average_waiting_time: "TEXT",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "created_at ASC NULLS LAST, id ASC"
  },
  schedules: {
    table: "schedules",
    fields: {
      doctor_id: "TEXT",
      day_of_week: "TEXT",
      start_time: "TEXT",
      end_time: "TEXT",
      max_patients: "INTEGER",
      average_consultation_minutes: "INTEGER",
      is_active: "BOOLEAN",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "doctor_id ASC NULLS LAST, day_of_week ASC, id ASC"
  },
  bookings: {
    table: "bookings",
    fields: {
      booking_code: "TEXT",
      clinic_id: "TEXT",
      doctor_id: "TEXT",
      patient_name: "TEXT",
      patient_phone: "TEXT",
      patient_age: "INTEGER",
      patient_gender: "TEXT",
      visit_reason: "TEXT",
      booking_date: "DATE",
      approximate_time: "TEXT",
      time_block: "TEXT",
      queue_number: "INTEGER",
      status: "TEXT",
      current_queue_snapshot: "INTEGER",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "booking_date DESC NULLS LAST, queue_number ASC NULLS LAST, created_at DESC NULLS LAST"
  },
  queueSessions: {
    table: "queue_sessions",
    fields: {
      clinic_id: "TEXT",
      doctor_id: "TEXT",
      date: "DATE",
      current_queue_number: "INTEGER",
      status: "TEXT",
      delay_message: "TEXT",
      delay_reason: "TEXT",
      delay_duration_minutes: "INTEGER",
      started_at: "TIMESTAMPTZ",
      closed_at: "TIMESTAMPTZ",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "date DESC NULLS LAST, doctor_id ASC NULLS LAST"
  },
  notifications: {
    table: "notifications",
    fields: {
      booking_id: "TEXT",
      clinic_id: "TEXT",
      type: "TEXT",
      message: "TEXT",
      status: "TEXT",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "created_at DESC NULLS LAST, id ASC"
  },
  subscriptions: {
    table: "subscriptions",
    fields: {
      clinic_id: "TEXT",
      plan: "TEXT",
      status: "TEXT",
      started_at: "TIMESTAMPTZ",
      current_period_end: "TIMESTAMPTZ",
      trial_ends_at: "TIMESTAMPTZ",
      seats: "INTEGER",
      price_iqd: "INTEGER",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "created_at ASC NULLS LAST, id ASC"
  },
  specialties: {
    table: "specialties",
    fields: {
      name: "TEXT",
      status: "TEXT",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "name ASC NULLS LAST, id ASC"
  },
  governorates: {
    table: "governorates",
    fields: {
      name: "TEXT",
      areas: "JSONB",
      created_at: "TIMESTAMPTZ",
      updated_at: "TIMESTAMPTZ"
    },
    orderBy: "name ASC NULLS LAST, id ASC"
  }
};

let pool;
let postgresReady = false;

function getPool() {
  if (pool) return pool;

  const { Pool } = require("pg");
  const ssl =
    process.env.PGSSLMODE === "disable" || process.env.POSTGRES_SSL === "false"
      ? false
      : { rejectUnauthorized: false };

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000
  });

  return pool;
}

function selectedCollections(collections) {
  if (!collections) return APP_COLLECTIONS;
  const requested = Array.isArray(collections) ? collections : [collections];
  return [...new Set(requested)].filter((collection) => COLLECTIONS[collection]);
}

function emptyDb() {
  return {
    meta: {},
    users: [],
    clinics: [],
    doctors: [],
    schedules: [],
    bookings: [],
    queueSessions: [],
    notifications: [],
    subscriptions: [],
    specialties: [],
    governorates: [],
    revenue: { placeholder_monthly_iqd: 0 },
    constants: {}
  };
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function tableName(config) {
  return quoteIdentifier(config.table);
}

function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeForWrite(type, value) {
  if (value === undefined || value === "") return null;
  if (type === "BOOLEAN") return value === true || value === "true" || value === "on";
  if (type === "INTEGER") {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : null;
  }
  if (type === "NUMERIC") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (type === "DATE") return normalizeDateOnly(value);
  if (type === "TIMESTAMPTZ") return normalizeTimestamp(value);
  if (type === "JSONB") return value === undefined ? null : JSON.stringify(value);
  return value === null ? null : String(value);
}

function normalizeFromRead(type, value) {
  if (value === null || value === undefined) return undefined;
  if (type === "DATE") return normalizeDateOnly(value);
  if (type === "TIMESTAMPTZ") return normalizeTimestamp(value);
  if (type === "INTEGER") return Number(value);
  if (type === "NUMERIC") return Number(value);
  return value;
}

function recordForCollection(collection, record, data) {
  if (collection === "notifications" && record.booking_id && !record.clinic_id) {
    const booking = data.bookings?.find((item) => item.id === record.booking_id);
    if (booking?.clinic_id) return { ...record, clinic_id: booking.clinic_id };
  }
  return record;
}

function rowToRecord(config, row) {
  const record = { ...(row.data || {}) };
  record.id = row.id;

  Object.entries(config.fields).forEach(([field, type]) => {
    const value = normalizeFromRead(type, row[field]);
    if (value !== undefined) record[field] = value;
  });

  return record;
}

async function ensurePostgresSchema(client = getPool()) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const config of Object.values(COLLECTIONS)) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${tableName(config)} (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const [field, type] of Object.entries(config.fields)) {
      await client.query(`
        ALTER TABLE ${tableName(config)}
        ADD COLUMN IF NOT EXISTS ${quoteIdentifier(field)} ${type};
      `);
    }
  }

  await client.query(`
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
  `);

  await backfillRelationalColumns(client);
}

async function backfillRelationalColumns(client) {
  for (const config of Object.values(COLLECTIONS)) {
    const assignments = Object.entries(config.fields)
      .map(([field, type]) => {
        const column = quoteIdentifier(field);
        if (type === "BOOLEAN") {
          return `${column} = COALESCE(${column}, CASE WHEN data ? '${field}' THEN (data->>'${field}')::boolean ELSE NULL END)`;
        }
        if (type === "INTEGER") {
          return `${column} = COALESCE(${column}, CASE WHEN data ? '${field}' THEN NULLIF(data->>'${field}', '')::integer ELSE NULL END)`;
        }
        if (type === "NUMERIC") {
          return `${column} = COALESCE(${column}, CASE WHEN data ? '${field}' THEN NULLIF(data->>'${field}', '')::numeric ELSE NULL END)`;
        }
        if (type === "DATE") {
          return `${column} = COALESCE(${column}, CASE WHEN data ? '${field}' THEN NULLIF(data->>'${field}', '')::date ELSE NULL END)`;
        }
        if (type === "TIMESTAMPTZ") {
          return `${column} = COALESCE(${column}, CASE WHEN data ? '${field}' THEN NULLIF(data->>'${field}', '')::timestamptz ELSE NULL END)`;
        }
        if (type === "JSONB") {
          return `${column} = COALESCE(${column}, data->'${field}')`;
        }
        return `${column} = COALESCE(${column}, NULLIF(data->>'${field}', ''))`;
      })
      .join(", ");

    if (assignments) {
      await client.query(`UPDATE ${tableName(config)} SET ${assignments} WHERE data <> '{}'::jsonb;`);
    }
  }
}

async function ensurePostgresDb() {
  if (postgresReady) return;

  const pg = getPool();
  await ensurePostgresSchema(pg);

  const result = await pg.query("SELECT COUNT(*)::int AS count FROM clinics");
  if (Number(result.rows[0]?.count || 0) === 0) {
    await writePostgresDb(createSeedData(), { skipEnsure: true });
  }

  postgresReady = true;
}

async function readPostgresDb() {
  await ensurePostgresDb();

  const pg = getPool();
  const data = emptyDb();

  const metaPromise = pg.query("SELECT key, value FROM app_meta");
  const collectionPromises = APP_COLLECTIONS.map(async (collection) => {
    const config = COLLECTIONS[collection];
    const columns = [
      "id",
      ...Object.keys(config.fields).map(quoteIdentifier),
      "data"
    ].join(", ");
    const rows = await pg.query(
      `SELECT ${columns} FROM ${tableName(config)} ORDER BY ${config.orderBy || "id ASC"}`
    );
    return [collection, rows.rows.map((row) => rowToRecord(config, row))];
  });

  const [meta, collections] = await Promise.all([
    metaPromise,
    Promise.all(collectionPromises)
  ]);

  meta.rows.forEach((row) => {
    data[row.key] = row.value;
  });

  collections.forEach(([collection, rows]) => {
    data[collection] = rows;
  });

  return data;
}

async function insertRecord(client, collection, record, data) {
  const config = COLLECTIONS[collection];
  const prepared = recordForCollection(collection, record, data);
  const fields = Object.keys(config.fields);
  const now = new Date().toISOString();
  const columns = ["id", ...fields, "data"];
  const values = [
    String(prepared.id),
    ...fields.map((field) =>
      field === "updated_at"
        ? normalizeTimestamp(prepared.updated_at) || now
        : normalizeForWrite(config.fields[field], prepared[field])
    ),
    JSON.stringify(prepared)
  ];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
    .join(", ");

  await client.query(
    `INSERT INTO ${tableName(config)} (${columns.map(quoteIdentifier).join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    values
  );
}

async function writePostgresDb(data, options = {}) {
  if (!options.skipEnsure) {
    await ensurePostgresDb();
  }

  const pg = getPool();
  const client = await pg.connect();
  const collections = selectedCollections(options.collections);
  const shouldWriteMeta = !options.collections || options.includeMeta;

  try {
    await client.query("BEGIN");
    await ensurePostgresSchema(client);

    for (const collection of [...collections].reverse()) {
      await client.query(`DELETE FROM ${tableName(COLLECTIONS[collection])}`);
    }

    for (const collection of collections) {
      const records = Array.isArray(data[collection]) ? data[collection] : [];
      for (const record of records) {
        if (record?.id) await insertRecord(client, collection, record, data);
      }
    }

    if (shouldWriteMeta) {
      const metaEntries = {
        meta: data.meta || {},
        revenue: data.revenue || { placeholder_monthly_iqd: 0 },
        constants: data.constants || {}
      };

      for (const [key, value] of Object.entries(metaEntries)) {
        await client.query(
          `INSERT INTO app_meta (key, value, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, JSON.stringify(value)]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function ensureJsonFallbackAllowed() {
  if (!ALLOW_JSON_FALLBACK) {
    throw new Error("DATABASE_URL is required for Dawri Medical SaaS production.");
  }
}

function ensureJsonDb() {
  ensureJsonFallbackAllowed();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    if (process.env.VERCEL && fs.existsSync(SOURCE_DB_PATH)) {
      fs.copyFileSync(SOURCE_DB_PATH, DB_PATH);
      return;
    }
    writeJsonDb(createSeedData());
  }
}

function readJsonDb() {
  ensureJsonDb();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (error) {
    const brokenPath = `${DB_PATH}.broken-${Date.now()}`;
    fs.renameSync(DB_PATH, brokenPath);
    const fresh = createSeedData();
    writeJsonDb(fresh);
    return fresh;
  }
}

function writeJsonDb(data) {
  ensureJsonFallbackAllowed();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, DB_PATH);
}

async function readDb() {
  if (USE_POSTGRES) return readPostgresDb();
  return readJsonDb();
}

async function writeDb(data, options = {}) {
  if (USE_POSTGRES) return writePostgresDb(data, options);
  writeJsonDb(data);
  return undefined;
}

module.exports = {
  DB_PATH,
  USE_POSTGRES,
  readDb,
  writeDb,
  ensurePostgresSchema
};
