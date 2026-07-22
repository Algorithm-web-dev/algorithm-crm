import { createClient } from '@/lib/supabase/server';
import DealsView from '@/components/kanban/DealsView';
import type { Deal, Contact, Company, Profile } from '@/types';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: deals }, { data: contacts }, { data: companies }, { data: profile }] =
    await Promise.all([
      supabase
        .from('deals')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase.from('contacts').select('*'),
      supabase.from('companies').select('*'),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ]);

  return (
    <DealsView
      initialDeals={(deals ?? []) as Deal[]}
      contacts={(contacts ?? []) as Contact[]}
      companies={(companies ?? []) as Company[]}
      profile={profile as Profile}
    />
  );
}
