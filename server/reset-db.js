const { createSeedData } = require("./seed");
const { writeDb, DB_PATH } = require("./database");

writeDb(createSeedData());
console.log(`Reset Dawri Medical demo database at ${DB_PATH}`);
