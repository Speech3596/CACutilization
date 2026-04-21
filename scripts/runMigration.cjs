/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const host = process.env.SUPABASE_DB_HOST;
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const port = parseInt(process.env.SUPABASE_DB_PORT || '5432', 10);
  if (!password || !host) {
    console.error('Missing SUPABASE_DB_PASSWORD or SUPABASE_DB_HOST');
    process.exit(1);
  }

  const files = [
    path.join(__dirname, '..', 'supabase', 'migrations', '0001_init.sql'),
    path.join(__dirname, '..', 'supabase', 'seed.sql')
  ];

  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('connected');

  for (const f of files) {
    const sql = fs.readFileSync(f, 'utf8');
    console.log(`\n--- running ${path.basename(f)} (${sql.length} bytes) ---`);
    try {
      const res = await client.query(sql);
      console.log('OK', Array.isArray(res) ? `${res.length} statement(s)` : '1 batch');
    } catch (e) {
      console.error(`ERROR in ${path.basename(f)}:`, e.message);
      throw e;
    }
  }

  const r = await client.query('select id, name, type, display_order from campuses order by display_order');
  console.log('\nseed check:');
  r.rows.forEach((row) => console.log(' -', row));

  await client.end();
  console.log('\ndone');
}

main().catch((e) => { console.error(e); process.exit(1); });
