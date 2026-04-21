/* eslint-disable */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) { console.error('usage: node scripts/verifyLogin.cjs <email> <password>'); process.exit(1); }

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  console.log('supabase url:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('anon key prefix:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 30));
  console.log('testing login for', email);

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('❌ FAIL:', error.status, error.message);
    process.exit(1);
  }
  console.log('✅ OK — session created');
  console.log('   user id:', data.user?.id);
  console.log('   email_confirmed_at:', data.user?.email_confirmed_at);
  console.log('   role:', data.user?.role);
})();
