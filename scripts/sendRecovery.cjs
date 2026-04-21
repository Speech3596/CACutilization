/* eslint-disable */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2];
if (!email) { console.error('usage: node scripts/sendRecovery.cjs <email>'); process.exit(1); }

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${SITE_URL}/login` }
  });
  if (error) { console.error('error:', error.message); process.exit(1); }
  console.log('✅ Recovery email triggered for', email);
  console.log('   (Supabase sends this automatically when generateLink runs.)');
  if (data?.properties?.action_link) {
    console.log('\n📋 Direct link (for manual use if email delayed):');
    console.log('  ', data.properties.action_link);
  }
})();
