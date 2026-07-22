import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types';
import SettingsForm from '@/components/forms/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <span className="text-xs text-text-muted">Your profile & preferences</span>
      </div>
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-2xl">
          <SettingsForm profile={profile as Profile} email={user.email || ''} />
        </div>
      </div>
    </>
  );
}
