import { createClient } from '@/lib/supabase/server';
import type { Contact, Company, Deal } from '@/types';
import ContactsView from '@/components/records/ContactsView';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: contacts }, { data: companies }, { data: deals }] = await Promise.all([
    supabase.from('contacts').select('*').order('created_at', { ascending: false }),
    supabase.from('companies').select('*'),
    supabase.from('deals').select('*'),
  ]);

  return (
    <ContactsView
      contacts={(contacts ?? []) as Contact[]}
      companies={(companies ?? []) as Company[]}
      deals={(deals ?? []) as Deal[]}
    />
  );
}
