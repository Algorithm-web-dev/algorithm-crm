'use client';

import { useState } from 'react';
import { type Deal, type Contact, type Company, type Profile, annualisedValue, fmtCurrencyFull, daysBetween } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/Toaster';
import Toaster from '@/components/ui/Toaster';
import { cn } from '@/lib/utils';

interface Props {
  initialDeals: Deal[];
  contacts: Contact[];
  companies: Company[];
  profile: Profile;
}

const REASON_COLORS: Record<string, string> = {
  'Price': 'bg-red-500/15 text-red-400',
  'Timing': 'bg-yellow-500/15 text-yellow-400',
  'Went with competitor': 'bg-orange-500/15 text-orange-400',
  'No decision': 'bg-slate-500/15 text-slate-400',
  'Not a fit': 'bg-purple-500/15 text-purple-400',
  'Other': 'bg-blue-500/15 text-blue-400',
};

export default function LostView({ initialDeals, contacts, companies, profile }: Props) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [reopening, setReopening] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<string>('all');

  const currency = profile?.default_currency || 'ZAR';
  const supabase = createClient();

  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const allReasons = Array.from(new Set(deals.map((d) => d.loss_reason).filter(Boolean)));

  const filtered = filterReason === 'all'
    ? deals
    : deals.filter((d) => d.loss_reason === filterReason);

  const totalLostValue = deals.reduce((s, d) => s + annualisedValue(d), 0);

  async function handleReopen(deal: Deal) {
    setReopening(deal.id);
    const { data, error } = await supabase
      .from('deals')
      .update({
        deal_stage: 'inbox',
        loss_reason: null,
        actual_close_date: null,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', deal.id)
      .select()
      .single();

    if (error) {
      toast('Failed to reopen deal', 'error');
      setReopening(null);
      return;
    }

    await supabase.from('activities').insert({
      owner_id: deal.owner_id,
      deal_id: deal.id,
      contact_id: deal.primary_contact_id,
      company_id: deal.company_id,
      type: 'stage',
      title: 'Deal reopened',
      body: 'Moved back to Inbox from Lost',
    });

    setDeals((prev) => prev.filter((d) => d.id !== deal.id));
    toast(`${deal.name.slice(0, 30)} moved back to Inbox`, 'success');
    setReopening(null);
  }

  return (
    <>
      <Toaster />
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Lost</h1>
          <span className="text-xs text-text-muted">Closed lost deals</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {deals.length} deal{deals.length !== 1 ? 's' : ''} · {fmtCurrencyFull(totalLostValue, currency)} total value
          </span>
          {allReasons.length > 0 && (
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="text-xs bg-slate-light border border-white/[0.08] rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
            >
              <option value="all">All reasons</option>
              {allReasons.map((r) => (
                <option key={r} value={r!}>{r}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-2xl font-extrabold text-text-primary mb-2">
              {deals.length === 0 ? 'No lost deals' : 'No deals match this filter'}
            </p>
            <p className="text-sm">
              {deals.length === 0
                ? 'Deals marked as lost will appear here for review.'
                : 'Try a different loss reason filter.'}
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards by reason */}
            {allReasons.length > 1 && filterReason === 'all' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {allReasons.map((reason) => {
                  const count = deals.filter((d) => d.loss_reason === reason).length;
                  const pct = Math.round((count / deals.length) * 100);
                  return (
                    <button
                      key={reason}
                      onClick={() => setFilterReason(reason!)}
                      className="bg-slate-light border border-white/[0.06] rounded-xl p-3 text-left hover:border-white/[0.12] transition-colors"
                    >
                      <div className="text-xl font-extrabold tabular-nums">{count}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">{pct}%</div>
                      <div className={cn('text-[10px] font-medium mt-1.5 px-1.5 py-0.5 rounded-full inline-block', REASON_COLORS[reason!] || 'bg-slate-500/15 text-slate-400')}>
                        {reason}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="bg-slate-light border border-white/[0.06] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-mono uppercase tracking-wider text-text-muted border-b border-white/[0.06]">
                    <th className="py-3 px-4">Deal</th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4">Loss Reason</th>
                    <th className="py-3 px-4">Lost</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((deal) => {
                    const contact = contactMap.get(deal.primary_contact_id || '');
                    const company = companyMap.get(deal.company_id || '');
                    const daysAgo = deal.actual_close_date ? daysBetween(deal.actual_close_date) : null;
                    const value = annualisedValue(deal);

                    return (
                      <tr key={deal.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-text-primary">{deal.name}</div>
                          {deal.source && (
                            <div className="text-[10px] text-text-muted mt-0.5">{deal.source}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-text-sub">
                          {company?.name || '—'}
                        </td>
                        <td className="py-3 px-4 text-text-sub">
                          {contact ? `${contact.first_name} ${contact.last_name}` : '—'}
                        </td>
                        <td className="py-3 px-4 tabular-nums font-medium">
                          {value > 0 ? fmtCurrencyFull(value, currency) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {deal.loss_reason ? (
                            <span className={cn('text-[10px] font-medium px-2 py-1 rounded-full', REASON_COLORS[deal.loss_reason] || 'bg-slate-500/15 text-slate-400')}>
                              {deal.loss_reason}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-text-muted text-xs tabular-nums">
                          {daysAgo !== null ? `${daysAgo}d ago` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleReopen(deal)}
                            disabled={reopening === deal.id}
                            className="text-xs font-medium text-accent hover:text-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg border border-accent/20 hover:border-accent/40"
                          >
                            {reopening === deal.id ? 'Reopening…' : 'Reopen'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
