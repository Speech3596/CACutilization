import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. **Never import this in a client component.**
 * Used for admin actions like invite, storage signing, etc.
 */
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false }
    }
  );
}
