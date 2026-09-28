import { createClient } from '@/lib/supabase/server';
import DealsView from '@/components/kanban/DealsView';
import type { Deal, Contact, Company, Profile } from '@/types';

export const dynamic = 'force-dynamic';

export default async function DealsPage({ searchParams }: { searchParams: { deal?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: deals }, { data: contacts }, { data: companies }, { data: profile }, { data: profiles }] =
    await Promise.all([
      supabase
        .from('deals')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase.from('contacts').select('*'),
      supabase.from('companies').select('*'),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('profiles').select('*').order('full_name'),
    ]);

  return (
    <DealsView
      initialDeals={(deals ?? []) as Deal[]}
      contacts={(contacts ?? []) as Contact[]}
      companies={(companies ?? []) as Company[]}
      profile={profile as Profile}
      profiles={(profiles ?? []) as Profile[]}
      currentUserId={user.id}
      openDealId={searchParams.deal}
    />
  );
}
