'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { type Contact, type Company, type Deal, annualisedValue, fmtCurrency, getStage, initialsOf } from '@/types';

interface Props {
  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
}

const COLUMNS = '1.6fr 1.4fr 2fr 110px 1.3fr';

// Open deals first, then won, then lost; newest first within each.
function rank(d: Deal) {
  return d.deal_stage === 'lost' ? 2 : d.deal_stage === 'won' ? 1 : 0;
}

export default function ContactsView({ contacts, companies, deals }: Props) {
  const [query, setQuery] = useState('');
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const dealsByContact = useMemo(() => {
    const m = new Map<string, Deal[]>();
    deals.forEach((d) => {
      if (!d.primary_contact_id) return;
      m.set(d.primary_contact_id, [...(m.get(d.primary_contact_id) ?? []), d]);
    });
    m.forEach((list) => list.sort((a, b) => rank(a) - rank(b) || b.updated_at.localeCompare(a.updated_at)));
    return m;
  }, [deals]);

  const q = query.trim().toLowerCase();
  const rows = q
    ? contacts.filter((c) =>
        [`${c.first_name} ${c.last_name ?? ''}`, companyMap.get(c.company_id || '')?.name ?? '', c.email]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : contacts;

  return (
    <>
      <div className="px-3 sm:px-6 py-3.5 border-b border-white/[0.06] flex flex-wrap items-center gap-x-4 gap-y-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-none">Contacts</h1>
          <div className="text-[11.5px] text-text-muted mt-1">Qualified people</div>
        </div>
        <div className="ml-auto flex items-center gap-3 w-full sm:w-auto">
          <span className="font-mono text-[10px] text-text-muted whitespace-nowrap">
            {rows.length === contacts.length ? `${contacts.length} contacts` : `${rows.length} of ${contacts.length}`}
          </span>
          <label className="relative flex-1 sm:flex-none sm:w-[260px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company or email"
              aria-label="Search contacts"
              className="w-full pl-8 pr-3 py-1.5 bg-deep-navy border border-white/10 rounded-full text-xs focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 sm:px-6 pt-4 pb-5">
        {contacts.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-2xl font-extrabold text-text-primary mb-2">No contacts yet</p>
            <p className="text-sm">Contacts are created when you promote a deal from an early stage.</p>
          </div>
        ) : (
          <div className="bg-navy border border-white/[0.06] rounded-xl overflow-x-auto">
            <div className="min-w-[860px]" role="table">
              <div
                role="row"
                className="sticky top-0 z-10 bg-navy grid gap-3 px-4 py-2.5 border-b border-white/[0.06] font-mono text-[9px] font-semibold tracking-[0.15em] uppercase text-text-muted"
                style={{ gridTemplateColumns: COLUMNS }}
              >
                <span>Name</span>
                <span>Company</span>
                <span>Email</span>
                <span>Phone</span>
                <span>Deal</span>
              </div>
              {rows.length === 0 && <div className="px-4 py-8 text-center text-sm text-text-muted">No contacts match “{query}”.</div>}
              {rows.map((c) => {
                const list = dealsByContact.get(c.id) ?? [];
                const top = list[0];
                const stage = top ? getStage(top.deal_stage) : null;
                const value = top ? annualisedValue(top) : 0;
                return (
                  <div
                    key={c.id}
                    role="row"
                    className="grid gap-3 items-center px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-slate transition-colors text-[13px]"
                    style={{ gridTemplateColumns: COLUMNS }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-brand-gradient text-deep-navy flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {initialsOf(c.first_name, c.last_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {c.first_name} {c.last_name}
                        </div>
                        {c.role_title && <div className="text-[11px] text-text-muted truncate">{c.role_title}</div>}
                      </div>
                    </div>
                    <div className="text-text-sub truncate">{companyMap.get(c.company_id || '')?.name || '—'}</div>
                    <a href={`mailto:${c.email}`} className="text-text-sub hover:text-accent truncate transition-colors">
                      {c.email}
                    </a>
                    <div className="text-text-muted tabular-nums truncate">{c.phone || '—'}</div>
                    <div className="min-w-0">
                      {top && stage ? (
                        <Link
                          href={`/deals?deal=${top.id}`}
                          title={top.name}
                          className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-full hover:brightness-125 transition"
                          style={{ background: `${stage.color}1f` }}
                        >
                          <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: stage.color }} />
                          <span className="font-mono text-[9.5px] font-semibold tracking-[0.1em] uppercase" style={{ color: stage.color }}>
                            {stage.name}
                          </span>
                          {value > 0 && <span className="font-mono text-[10px] text-text-sub">{fmtCurrency(value, top.currency)}</span>}
                          {list.length > 1 && <span className="font-mono text-[10px] text-text-muted">+{list.length - 1}</span>}
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
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
