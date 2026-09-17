import { createPool, runMigrations } from "./pool.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const pool = createPool(url);
  try {
    await runMigrations(pool);
    console.log("Migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
