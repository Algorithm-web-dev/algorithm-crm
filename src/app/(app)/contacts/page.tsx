import { createClient } from '@/lib/supabase/server';
import type { Contact, Company } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });
  const { data: companies } = await supabase
    .from('companies')
    .select('*');

  const cMap = new Map((companies as Company[] ?? []).map((c) => [c.id, c]));

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <h1 className="text-2xl font-extrabold tracking-tight">Contacts</h1>
        <span className="text-xs text-text-muted">Qualified people</span>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {((contacts as Contact[]) ?? []).length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-2xl font-extrabold text-text-primary mb-2">No contacts yet</p>
            <p className="text-sm">
              Contacts are created when you promote a deal from an early stage. They appear here once you have any.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-text-muted border-b border-white/[0.06]">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3">Company</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Phone</th>
              </tr>
            </thead>
            <tbody>
              {(contacts as Contact[]).map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-3 px-3">
                    <div className="font-semibold">{c.first_name} {c.last_name}</div>
                    <div className="text-xs text-text-muted">{c.role_title}</div>
                  </td>
                  <td className="py-3 px-3 text-text-sub">{cMap.get(c.company_id || '')?.name || '—'}</td>
                  <td className="py-3 px-3 text-text-muted">{c.email}</td>
                  <td className="py-3 px-3 text-text-muted">{c.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
