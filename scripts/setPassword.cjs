/* eslint-disable */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error('usage: node scripts/setPassword.cjs <email> <password>');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = list?.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) { console.error('user not found:', email); process.exit(1); }

  const { error } = await supabase.auth.admin.updateUserById(u.id, {
    password,
    email_confirm: true
  });
  if (error) { console.error('error:', error.message); process.exit(1); }
  console.log(`✅ Password set for ${email}`);
  console.log(`   id=${u.id}`);
})();
