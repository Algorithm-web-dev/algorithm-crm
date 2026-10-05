'use client';

import { useState } from 'react';
import {
  type Deal,
  type Contact,
  type Company,
  type Profile,
  LOSS_REASONS,
  annualisedValue,
  fmtCurrencyFull,
  initialsOf,
} from '@/types';
import { createClient } from '@/lib/supabase/client';
import Toaster, { toast } from '@/components/ui/Toaster';
import Modal from '@/components/ui/Modal';
import { Button, Label, Select } from '@/components/ui/Form';
import DeleteDealModal from '@/components/forms/DeleteDealModal';
import { cn } from '@/lib/utils';

interface Props {
  initialDeals: Deal[];
  contacts: Contact[];
  companies: Company[];
  profile: Profile;
}

const COLUMNS = '2fr 1.4fr 1.6fr 120px 140px 80px 150px';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: '2-digit' }) });
}

export default function LostView({ initialDeals, contacts, companies, profile }: Props) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [reopening, setReopening] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);
  const [addingReason, setAddingReason] = useState<Deal | null>(null);
  const [filterReason, setFilterReason] = useState<string>('all');
  const isDirector = !!profile?.is_director;
  const currency = profile?.default_currency || 'ZAR';
  const supabase = createClient();

  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const allReasons = Array.from(new Set(deals.map((d) => d.loss_reason).filter(Boolean))) as string[];
  const filtered =
    filterReason === 'all'
      ? deals
      : filterReason === 'none'
      ? deals.filter((d) => !d.loss_reason)
      : deals.filter((d) => d.loss_reason === filterReason);
  const totalLostValue = deals.reduce((s, d) => s + annualisedValue(d), 0);
  const missingReason = deals.filter((d) => !d.loss_reason).length;

  async function handleReopen(deal: Deal) {
    setReopening(deal.id);
    const { error } = await supabase
      .from('deals')
      .update({
        deal_stage: 'inbox',
        loss_reason: null,
        actual_close_date: null,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', deal.id);
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
      {deleting && (
        <DeleteDealModal
          deal={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setDeals((prev) => prev.filter((d) => d.id !== id));
            setDeleting(null);
          }}
        />
      )}
      {addingReason && (
        <AddReasonModal
          deal={addingReason}
          onClose={() => setAddingReason(null)}
          onSaved={(d) => {
            setDeals((prev) => prev.map((x) => (x.id === d.id ? d : x)));
            setAddingReason(null);
          }}
        />
      )}

      {/* HEADER: title · metrics · filter */}
      <div className="px-3 sm:px-6 py-3.5 border-b border-white/[0.06] flex flex-wrap items-center gap-x-7 gap-y-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-none">Lost</h1>
          <div className="text-[11.5px] text-text-muted mt-1">Closed lost deals</div>
        </div>
        <div className="flex">
          <HeaderMetric label="Deals" value={String(deals.length)} />
          <HeaderMetric label="Total value" value={fmtCurrencyFull(totalLostValue, currency)} />
        </div>
        {deals.length > 0 && (
          <select
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
            className="ml-auto text-xs bg-deep-navy border border-white/10 rounded-full px-3 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
            aria-label="Filter by loss reason"
          >
            <option value="all">All reasons</option>
            {allReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            {missingReason > 0 && <option value="none">No reason recorded</option>}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-auto px-3 sm:px-6 pt-4 pb-5 flex flex-col gap-3">
        {missingReason > 0 && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-priority-medium/[0.08] border border-priority-medium/25 rounded-[10px] text-[12.5px] text-text-sub">
            <span className="w-2 h-2 rounded-full bg-priority-medium flex-shrink-0" />
            No loss reason recorded on {missingReason} of {deals.length} deals.
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
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
          <div className="bg-navy border border-white/[0.06] rounded-xl overflow-x-auto">
            <div className="min-w-[940px]" role="table">
              <div
                role="row"
                className="grid gap-3 px-4 py-2.5 border-b border-white/[0.06] font-mono text-[9px] font-semibold tracking-[0.15em] uppercase text-text-muted"
                style={{ gridTemplateColumns: COLUMNS }}
              >
                <span>Deal</span>
                <span>Company</span>
                <span>Contact</span>
                <span className="text-right">Value</span>
                <span>Loss reason</span>
                <span>Lost</span>
                <span />
              </div>
              {filtered.map((deal) => {
                const contact = contactMap.get(deal.primary_contact_id || '');
                const company = companyMap.get(deal.company_id || '');
                const contactName = contact
                  ? `${contact.first_name} ${contact.last_name ?? ''}`.trim()
                  : [deal.lead_first_name, deal.lead_last_name].filter(Boolean).join(' ');
                const value = annualisedValue(deal);
                return (
                  <div
                    key={deal.id}
                    role="row"
                    className="grid gap-3 items-center px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-slate transition-colors text-[13px]"
                    style={{ gridTemplateColumns: COLUMNS }}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-text-primary truncate">{deal.name}</div>
                      {deal.source && (
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted mt-0.5">
                          {deal.source}
                        </div>
                      )}
                    </div>
                    <div className="text-text-sub truncate">{company?.name || deal.lead_company_name || '—'}</div>
                    <div className="flex items-center gap-2 min-w-0 text-text-sub">
                      {contactName ? (
                        <>
                          <span className="w-5 h-5 rounded-full bg-priority-high/20 text-red-400 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                            {contact
                              ? initialsOf(contact.first_name, contact.last_name)
                              : initialsOf(deal.lead_first_name, deal.lead_last_name)}
                          </span>
                          <span className="truncate">{contactName}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </div>
                    <div className="text-right font-bold tabular-nums">
                      {value > 0 ? fmtCurrencyFull(value, deal.currency || currency) : '—'}
                    </div>
                    <div>
                      {deal.loss_reason ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-priority-high/15 text-red-400">
                          {deal.loss_reason}
                        </span>
                      ) : (
                        <button
                          onClick={() => setAddingReason(deal)}
                          className="text-[12px] font-medium text-accent hover:text-accent/80"
                        >
                          + Add reason
                        </button>
                      )}
                    </div>
                    <div className="text-text-muted text-xs tabular-nums">{fmtDate(deal.actual_close_date)}</div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleReopen(deal)}
                        disabled={reopening === deal.id}
                        className="text-xs font-medium px-3 py-1 rounded-full bg-accent/[0.08] border border-accent/30 text-accent hover:bg-accent/15 disabled:opacity-40 transition-colors"
                      >
                        {reopening === deal.id ? 'Reopening…' : 'Reopen'}
                      </button>
                      {isDirector && (
                        <button
                          onClick={() => setDeleting(deal)}
                          className={cn(
                            'text-xs font-medium px-3 py-1 rounded-full transition-colors',
                            'bg-priority-high/15 border border-priority-high/30 text-priority-high hover:bg-priority-high/25',
                          )}
                        >
                          Delete
                        </button>
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

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 border-l border-white/[0.06] first:pl-0 first:border-l-0 sm:first:pl-6 sm:first:border-l">
      <div className="font-mono text-[9px] font-semibold tracking-[0.15em] text-text-muted mb-1 uppercase">{label}</div>
      <div className="text-[20px] font-extrabold tracking-tight leading-none tabular-nums">{value}</div>
    </div>
  );
}

function AddReasonModal({ deal, onClose, onSaved }: { deal: Deal; onClose: () => void; onSaved: (d: Deal) => void }) {
  const [reason, setReason] = useState<string>(LOSS_REASONS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data, error } = await createClient()
      .from('deals')
      .update({ loss_reason: reason })
      .eq('id', deal.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast('Could not save reason', 'error');
      return;
    }
    toast('Loss reason saved', 'success');
    onSaved(data as Deal);
  }

  return (
    <Modal
      title="Add loss reason"
      subtitle={deal.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save reason'}
          </Button>
        </>
      }
    >
      <Label required>Loss reason</Label>
      <Select value={reason} onChange={(e) => setReason(e.target.value)}>
        {LOSS_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
    </Modal>
  );
}
