// Run Supabase SQL migrations against a Postgres connection string
// Usage: set SUPABASE_DB_URL and run `node supabase/run_migrations.js`
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// `pg` is intentionally NOT a project dependency. Install it only where you run this script:
//   npm install --no-save pg
let Client;
try {
  ({ Client } = await import('pg'));
} catch {
  console.error('Missing dependency: run `npm install --no-save pg` first.');
  process.exit(1);
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.error('Please set SUPABASE_DB_URL environment variable to your Supabase Postgres connection string.');
    process.exit(1);
  }

  const sqlPath = path.resolve(__dirname, 'migrations', 'gamification_tables.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to database, running migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed, rolling back:', err.message || err);
    try { await client.query('ROLLBACK'); } catch (e) {}
    process.exit(2);
  } finally {
    await client.end();
  }
}

if (require.main === module) run();
