import { createClient } from '@/lib/supabase/server';
import type { Notification } from '@/types';
import NotificationsView from '@/components/notifications/NotificationsView';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  return <NotificationsView initial={(data ?? []) as Notification[]} />;
}
