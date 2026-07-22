import { createClient } from '@/lib/supabase/server';
import type { Company, Contact, Deal } from '@/types';
import { annualisedValue, fmtCurrencyFull } from '@/types';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: companies }, { data: contacts }, { data: deals }] = await Promise.all([
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('contacts').select('*'),
    supabase.from('deals').select('*'),
  ]);

  const contactsByCompany = new Map<string, number>();
  ((contacts as Contact[]) ?? []).forEach((c) => {
    if (c.company_id) {
      contactsByCompany.set(c.company_id, (contactsByCompany.get(c.company_id) ?? 0) + 1);
    }
  });

  const dealsByCompany = new Map<string, { count: number; value: number }>();
  ((deals as Deal[]) ?? []).forEach((d) => {
    if (d.company_id) {
      const cur = dealsByCompany.get(d.company_id) ?? { count: 0, value: 0 };
      cur.count++;
      cur.value += annualisedValue(d);
      dealsByCompany.set(d.company_id, cur);
    }
  });

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <h1 className="text-2xl font-extrabold tracking-tight">Companies</h1>
        <span className="text-xs text-text-muted">Organisations</span>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {((companies as Company[]) ?? []).length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-2xl font-extrabold text-text-primary mb-2">No companies yet</p>
            <p className="text-sm">
              Companies are created automatically when you promote deals out of early stages.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-mono uppercase tracking-wider text-text-muted border-b border-white/[0.06]">
                <th className="py-2 px-3">Company</th>
                <th className="py-2 px-3">Industry</th>
                <th className="py-2 px-3">Contacts</th>
                <th className="py-2 px-3">Deals</th>
                <th className="py-2 px-3">Total value</th>
              </tr>
            </thead>
            <tbody>
              {(companies as Company[]).map((co) => {
                const ds = dealsByCompany.get(co.id) ?? { count: 0, value: 0 };
                return (
                  <tr key={co.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-3 px-3 font-semibold">{co.name}</td>
                    <td className="py-3 px-3 text-text-sub">{co.industry || '—'}</td>
                    <td className="py-3 px-3 tabular-nums">{contactsByCompany.get(co.id) ?? 0}</td>
                    <td className="py-3 px-3 tabular-nums">{ds.count}</td>
                    <td className="py-3 px-3 tabular-nums">{fmtCurrencyFull(ds.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
