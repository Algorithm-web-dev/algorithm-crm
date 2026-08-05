import { createClient } from '@/lib/supabase/server';
import type { Deal, Contact, Company, Profile } from '@/types';
import LostView from '@/components/lost/LostView';

export const dynamic = 'force-dynamic';

export default async function LostPage() {
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
        .eq('deal_stage', 'lost')
        .order('updated_at', { ascending: false }),
      supabase.from('contacts').select('*'),
      supabase.from('companies').select('*'),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ]);

  return (
    <LostView
      initialDeals={(deals ?? []) as Deal[]}
      contacts={(contacts ?? []) as Contact[]}
      companies={(companies ?? []) as Company[]}
      profile={profile as Profile}
    />
  );
}
