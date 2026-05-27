const { createSeedData } = require("./seed");
const { writeDb, DB_PATH, USE_POSTGRES } = require("./database");

async function main() {
  await writeDb(createSeedData());
  const target = USE_POSTGRES ? "PostgreSQL DATABASE_URL" : DB_PATH;
  console.log(`Reset Dawri Medical demo database at ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
