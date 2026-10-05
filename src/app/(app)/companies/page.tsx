import { createClient } from '@/lib/supabase/server';
import type { Company, Contact, Deal } from '@/types';
import CompaniesView from '@/components/records/CompaniesView';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: companies }, { data: contacts }, { data: deals }] = await Promise.all([
    supabase.from('companies').select('*'),
    supabase.from('contacts').select('*'),
    supabase.from('deals').select('*'),
  ]);

  return (
    <CompaniesView
      companies={(companies ?? []) as Company[]}
      contacts={(contacts ?? []) as Contact[]}
      deals={(deals ?? []) as Deal[]}
    />
  );
}
