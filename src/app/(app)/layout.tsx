import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { count: unreadCount }, { count: lostCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('deal_stage', 'lost'),
  ]);

  return (
    <AppShell
      userName={profile?.full_name || user.email?.split('@')[0] || 'You'}
      userEmail={user.email || ''}
      unreadCount={unreadCount ?? 0}
      lostCount={lostCount ?? 0}
    >
      {children}
    </AppShell>
  );
}
