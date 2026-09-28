import { createServerClient } from '@supabase/ssr';

// Service-role client — bypasses RLS. Server-only (cron jobs, API-key routes).
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}
