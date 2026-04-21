/* eslint-disable */
// Usage: SUPABASE_PROJECT_REF=xxxx SUPABASE_DB_PASSWORD=yyyy node scripts/findPooler.cjs
const { Client } = require('pg');

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const REGIONS = [
  'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'sa-east-1', 'ca-central-1', 'ap-south-1'
];

async function tryHost(host) {
  const c = new Client({
    host, port: 5432, user: `postgres.${ref}`,
    password, database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch (e) {
    try { await c.end(); } catch {}
    return e.message;
  }
}

(async () => {
  for (const r of REGIONS) {
    for (const prefix of ['aws-0', 'aws-1']) {
      const host = `${prefix}-${r}.pooler.supabase.com`;
      const res = await tryHost(host);
      if (res === true) { console.log('FOUND:', host); process.exit(0); }
      if (typeof res === 'string' && !res.includes('ENOTFOUND') && !res.includes('not found') && !res.includes('timeout')) {
        console.log('?', host, '->', res);
      }
    }
  }
  console.log('none worked');
})();
