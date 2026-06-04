// Run Supabase SQL migrations against a Postgres connection string
// Usage: set SUPABASE_DB_URL and run `node supabase/run_migrations.js`
const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

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
