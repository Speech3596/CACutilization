/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKETS = ['student-snapshots', 'access-logs', 'reports'];

(async () => {
  const supabase = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  for (const name of BUCKETS) {
    const { data: existing } = await supabase.storage.getBucket(name);
    if (existing) {
      console.log(`[skip] bucket "${name}" already exists`);
      continue;
    }
    const { error } = await supabase.storage.createBucket(name, {
      public: false
    });
    if (error) {
      console.error(`[fail] ${name}:`, error.message);
      process.exit(1);
    }
    console.log(`[ok]   created "${name}" (private)`);
  }

  const { data: list } = await supabase.storage.listBuckets();
  console.log('\nall buckets:', list?.map(b => `${b.name}(${b.public ? 'public' : 'private'})`).join(', '));
})();
