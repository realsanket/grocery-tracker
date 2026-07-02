// Dev utility: quick sanity check of DB connectivity and table/row counts.
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by 1`;
  for (const t of tables) {
    const [{ count }] = await sql.query(
      `select count(*)::int as count from "${t.table_name}"`,
    );
    console.log(`${t.table_name}: ${count} rows`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
