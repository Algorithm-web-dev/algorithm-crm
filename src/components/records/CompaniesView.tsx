'use client';

import { type Company, type Contact, type Deal, annualisedValue, fmtCurrencyFull, getStage } from '@/types';

interface Props {
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
}

const COLUMNS = '2fr 90px 1fr 2fr 120px';

// Status colours reuse existing tokens: accent-2, accent, priority-high, text-muted.
const STATUS = {
  client: { label: 'Client', color: '#00e0a0' },
  pipeline: { label: 'In pipeline', color: '#4f8cff' },
  lost: { label: 'Lost', color: '#c1272d' },
  none: { label: 'No deals', color: '#8a94b0' },
} as const;

export default function CompaniesView({ companies, contacts, deals }: Props) {
  const rows = companies
    .map((co) => {
      const ds = deals.filter((d) => d.company_id === co.id);
      const status: keyof typeof STATUS = ds.some((d) => d.deal_stage === 'won')
        ? 'client'
        : ds.some((d) => d.deal_stage !== 'lost')
        ? 'pipeline'
        : ds.length
        ? 'lost'
        : 'none';
      return {
        co,
        deals: ds,
        contacts: contacts.filter((c) => c.company_id === co.id).length,
        value: ds.reduce((s, d) => s + annualisedValue(d), 0),
        currency: ds[0]?.currency ?? 'ZAR',
        status,
      };
    })
    .sort((a, b) => b.value - a.value || a.co.name.localeCompare(b.co.name));
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <>
      <div className="px-3 sm:px-6 py-3.5 border-b border-white/[0.06] flex flex-wrap items-center gap-x-4 gap-y-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-none">Companies</h1>
          <div className="text-[11.5px] text-text-muted mt-1">Organisations</div>
        </div>
        <span className="ml-auto font-mono text-[10px] text-text-muted">{companies.length} companies</span>
      </div>

      <div className="flex-1 overflow-auto px-3 sm:px-6 pt-4 pb-5">
        {companies.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-2xl font-extrabold text-text-primary mb-2">No companies yet</p>
            <p className="text-sm">Companies are created automatically when you promote deals out of early stages.</p>
          </div>
        ) : (
          <div className="bg-navy border border-white/[0.06] rounded-xl overflow-x-auto">
            <div className="min-w-[760px]" role="table">
              <div
                role="row"
                className="sticky top-0 z-10 bg-navy grid gap-3 px-4 py-2.5 border-b border-white/[0.06] font-mono text-[9px] font-semibold tracking-[0.15em] uppercase text-text-muted"
                style={{ gridTemplateColumns: COLUMNS }}
              >
                <span>Company</span>
                <span className="text-right">Contacts</span>
                <span>Deals</span>
                <span>Total value</span>
                <span>Status</span>
              </div>
              {rows.map((r) => {
                const st = STATUS[r.status];
                return (
                  <div
                    key={r.co.id}
                    role="row"
                    className="grid gap-3 items-center px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-slate transition-colors text-[13px]"
                    style={{ gridTemplateColumns: COLUMNS }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-light border border-white/[0.08] flex items-center justify-center text-[11px] font-bold text-text-sub flex-shrink-0">
                        {r.co.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.co.name}</div>
                        {r.co.industry && <div className="text-[11px] text-text-muted truncate">{r.co.industry}</div>}
                      </div>
                    </div>
                    <div className="text-right tabular-nums text-text-sub">{r.contacts}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="tabular-nums text-text-sub w-4">{r.deals.length}</span>
                      <span className="flex flex-wrap gap-1">
                        {r.deals.map((d) => {
                          const s = getStage(d.deal_stage);
                          return (
                            <span
                              key={d.id}
                              className="w-[7px] h-[7px] rounded-full"
                              style={{ background: s.color }}
                              title={`${d.name} · ${s.name}`}
                            />
                          );
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-[96px] flex-shrink-0 text-right font-bold tabular-nums">
                        {r.value > 0 ? fmtCurrencyFull(r.value, r.currency) : '—'}
                      </span>
                      <span className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-brand-gradient"
                          style={{ width: `${(r.value / max) * 100}%` }}
                        />
                      </span>
                    </div>
                    <div>
                      <span
                        className="font-mono text-[9.5px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: `${st.color}1f`, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
