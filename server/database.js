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

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    if (process.env.VERCEL && fs.existsSync(SOURCE_DB_PATH)) {
      fs.copyFileSync(SOURCE_DB_PATH, DB_PATH);
      return;
    }
    writeDb(createSeedData());
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (error) {
    const brokenPath = `${DB_PATH}.broken-${Date.now()}`;
    fs.renameSync(DB_PATH, brokenPath);
    const fresh = createSeedData();
    writeDb(fresh);
    return fresh;
  }
}

function writeDb(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, DB_PATH);
}

module.exports = {
  DB_PATH,
  readDb,
  writeDb
};
