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

const COLLECTION_TABLES = {
  users: "users",
  clinics: "clinics",
  doctors: "doctors",
  schedules: "schedules",
  bookings: "bookings",
  queueSessions: "queue_sessions",
  notifications: "notifications",
  specialties: "specialties",
  governorates: "governorates"
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
    ssl
  });

  return pool;
}

function selectedCollectionEntries(collections) {
  if (!collections) return Object.entries(COLLECTION_TABLES);
  const requested = Array.isArray(collections) ? collections : [collections];
  const unique = [...new Set(requested)].filter((collection) => COLLECTION_TABLES[collection]);
  return unique.map((collection) => [collection, COLLECTION_TABLES[collection]]);
}

async function ensurePostgresSchema(client = getPool()) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clinics (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS queue_sessions (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS specialties (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS governorates (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS doctors_clinic_idx
      ON doctors ((data->>'clinic_id'));

    CREATE INDEX IF NOT EXISTS bookings_doctor_date_idx
      ON bookings ((data->>'doctor_id'), (data->>'booking_date'));

    CREATE INDEX IF NOT EXISTS bookings_phone_idx
      ON bookings ((data->>'patient_phone'));

    CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_active_phone_idx
      ON bookings ((data->>'doctor_id'), (data->>'booking_date'), (data->>'patient_phone'))
      WHERE data->>'status' <> 'cancelled';

    CREATE INDEX IF NOT EXISTS queue_sessions_doctor_date_idx
      ON queue_sessions ((data->>'doctor_id'), (data->>'date'));
  `);
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
  const data = {
    meta: {},
    users: [],
    clinics: [],
    doctors: [],
    schedules: [],
    bookings: [],
    queueSessions: [],
    notifications: [],
    specialties: [],
    governorates: [],
    revenue: { placeholder_monthly_iqd: 0 },
    constants: {}
  };

  const metaPromise = pg.query("SELECT key, value FROM app_meta");
  const collectionPromises = Object.entries(COLLECTION_TABLES).map(async ([collection, table]) => {
    const rows = await pg.query(`SELECT data FROM ${table} ORDER BY id ASC`);
    return [collection, rows.rows.map((row) => row.data)];
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

async function writePostgresDb(data, options = {}) {
  if (!options.skipEnsure) {
    await ensurePostgresDb();
  }

  const pg = getPool();
  const client = await pg.connect();
  const collectionEntries = selectedCollectionEntries(options.collections);
  const shouldWriteMeta = !options.collections || options.includeMeta;

  try {
    await client.query("BEGIN");
    await ensurePostgresSchema(client);

    for (const table of collectionEntries.map(([, table]) => table).reverse()) {
      await client.query(`DELETE FROM ${table}`);
    }

    for (const [collection, table] of collectionEntries) {
      const records = Array.isArray(data[collection]) ? data[collection] : [];
      for (const record of records) {
        await client.query(
          `INSERT INTO ${table} (id, data, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [String(record.id), JSON.stringify(record)]
        );
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

function ensureJsonDb() {
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
  writeDb
};
