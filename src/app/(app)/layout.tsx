import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ]);

  return (
    <div className="grid grid-cols-[220px_1fr] h-screen overflow-hidden bg-deep-navy">
      <Sidebar
        userName={profile?.full_name || user.email?.split('@')[0] || 'You'}
        userEmail={user.email || ''}
        unreadCount={unreadCount ?? 0}
      />
      <main className="flex flex-col overflow-hidden bg-deep-navy">{children}</main>
    </div>
  );
}
