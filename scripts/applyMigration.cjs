/* eslint-disable */
// Usage: node scripts/applyMigration.cjs <filename-under-supabase/migrations>
// Example: node scripts/applyMigration.cjs 0002_relax_report_fks.sql
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/applyMigration.cjs <filename-under-supabase/migrations>');
    process.exit(1);
  }

  const password = process.env.SUPABASE_DB_PASSWORD;
  const host     = process.env.SUPABASE_DB_HOST;
  const user     = process.env.SUPABASE_DB_USER || 'postgres';
  const port     = parseInt(process.env.SUPABASE_DB_PORT || '5432', 10);
  if (!password || !host) {
    console.error('Missing SUPABASE_DB_PASSWORD or SUPABASE_DB_HOST in env');
    process.exit(1);
  }

  const full = path.join(__dirname, '..', 'supabase', 'migrations', file);
  if (!fs.existsSync(full)) {
    console.error('not found:', full);
    process.exit(1);
  }
  const sql = fs.readFileSync(full, 'utf8');

  const client = new Client({
    host, port, user, password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('connected');
  console.log(`\n--- running ${file} (${sql.length} bytes) ---`);
  try {
    await client.query(sql);
    console.log('OK');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
  await client.end();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
