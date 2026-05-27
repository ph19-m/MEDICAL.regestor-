const fs = require("fs");
const path = require("path");
const { createSeedData } = require("./seed");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
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
