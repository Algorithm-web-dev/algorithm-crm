'use client';

import { useEffect, useState } from 'react';
import {
  type Deal,
  type Contact,
  type Company,
  type Profile,
  type DealStage,
  PIPELINE_STAGES,
  annualisedValue,
  weightedValue,
  fmtCurrencyFull,
  getStage,
  nextStage,
  daysBetween,
  initialsOf,
  profileName,
} from '@/types';
import { createClient } from '@/lib/supabase/client';
import { Button, Textarea } from '@/components/ui/Form';
import { toast } from '@/components/ui/Toaster';
import { DaysChip } from '@/components/kanban/DealCard';
import { cn } from '@/lib/utils';

interface Props {
  deal: Deal; // an open deal (Won/Lost use ClosedDealModal)
  contacts: Contact[];
  companies: Company[];
  profiles: Profile[];
  onClose: () => void;
  onEdit: () => void;
  onMarkLost: () => void;
  onMove: (to: DealStage) => void; // same path as a drag (promote / won confirm apply)
  onUpdated: (deal: Deal) => void;
}

export default function DealDrawer({
  deal,
  contacts,
  companies,
  profiles,
  onClose,
  onEdit,
  onMarkLost,
  onMove,
  onUpdated,
}: Props) {
  const stage = getStage(deal.deal_stage);
  const next = nextStage(deal.deal_stage);
  const stageIdx = PIPELINE_STAGES.findIndex((s) => s.id === deal.deal_stage);
  const company = companies.find((c) => c.id === deal.company_id);
  const contact = contacts.find((c) => c.id === deal.primary_contact_id);
  const owner = profileName(profiles.find((p) => p.id === deal.deal_owner_id));
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name ?? ''}`.trim()
    : [deal.lead_first_name, deal.lead_last_name].filter(Boolean).join(' ');
  const contactInitials = contact
    ? initialsOf(contact.first_name, contact.last_name)
    : initialsOf(deal.lead_first_name, deal.lead_last_name);
  const days = daysBetween(deal.stage_entered_at);

  const [notes, setNotes] = useState(deal.notes || '');
  useEffect(() => setNotes(deal.notes || ''), [deal.id, deal.notes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function saveNotes() {
    if (notes === (deal.notes || '')) return;
    const { data, error } = await createClient()
      .from('deals')
      .update({ notes, last_activity_at: new Date().toISOString() })
      .eq('id', deal.id)
      .select()
      .single();
    if (error) {
      toast('Notes not saved', 'error');
      return;
    }
    toast('Notes saved', 'success');
    onUpdated(data as Deal);
  }

  const details: [string, React.ReactNode][] = [
    [
      'Contact',
      contactName ? (
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-[18px] h-[18px] rounded-full bg-brand-gradient flex items-center justify-center text-deep-navy font-bold text-[8px] flex-shrink-0">
            {contactInitials}
          </span>
          <span className="truncate">{contactName}</span>
        </span>
      ) : (
        <span className="text-text-muted">—</span>
      ),
    ],
    [
      'Deal owner',
      <span key="o" className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent">
        {owner}
      </span>,
    ],
    [
      'Priority',
      <span key="p" className="flex items-center gap-1.5">
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            deal.priority === 'High' ? 'bg-priority-high' : deal.priority === 'Medium' ? 'bg-priority-medium' : 'bg-priority-low',
          )}
        />
        {deal.priority}
      </span>,
    ],
    ['Source', deal.source || '—'],
    ['Company', company?.name || deal.lead_company_name || '—'],
    ['One-off value', deal.one_off_value > 0 ? fmtCurrencyFull(deal.one_off_value, deal.currency) : '—'],
    ['In stage', days != null ? <DaysChip key="d" days={days} /> : '—'],
  ];

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-label={`${deal.name} details`}>
      <div className="absolute inset-0 bg-deep-navy/55" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 h-full w-[480px] max-w-full bg-navy border-l border-white/[0.08] flex flex-col"
        style={{ boxShadow: '-24px 0 60px rgba(0,0,0,.5)' }}
      >
        {/* HEADER */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold tracking-[0.15em] uppercase"
              style={{ background: `${stage.color}1f`, color: stage.color }}
            >
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: stage.color }} />
              {stage.name}
            </span>
            <span className="font-mono text-[10px] text-text-muted">{stage.prob}% close probability</span>
            <button
              onClick={onClose}
              className="ml-auto text-text-muted hover:text-text-primary p-1 -mr-1 rounded"
              aria-label="Close"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <h2 className="text-[22px] font-extrabold tracking-tight leading-tight mt-3 break-words">
            {company?.name || deal.lead_company_name || deal.name}
          </h2>
          <div className="text-[13px] text-text-muted mt-0.5">{deal.name}</div>

          <div className="flex gap-[3px] mt-4">
            {PIPELINE_STAGES.map((s, i) => (
              <div key={s.id} className="flex-1 min-w-0">
                <div
                  className="h-1 rounded-full"
                  style={{ background: i <= stageIdx ? s.color : 'rgba(255,255,255,0.08)' }}
                />
                <div
                  className={cn(
                    'font-mono text-[9px] uppercase tracking-[0.08em] mt-1.5 truncate',
                    i === stageIdx ? 'text-text-primary' : 'text-text-muted',
                  )}
                  title={s.name}
                >
                  {s.name.slice(0, 4)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 p-5 flex flex-col gap-5 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['Annualised', fmtCurrencyFull(annualisedValue(deal), deal.currency), ''],
                ['Monthly', fmtCurrencyFull(Number(deal.monthly_value) || 0, deal.currency), ''],
                ['Weighted', fmtCurrencyFull(weightedValue(deal), deal.currency), 'text-accent'],
              ] as const
            ).map(([label, value, cls]) => (
              <div key={label} className="bg-slate border border-white/[0.06] rounded-[10px] p-3 min-w-0">
                <div className="font-mono text-[9px] font-semibold tracking-[0.15em] uppercase text-text-muted">{label}</div>
                <div className={cn('text-[15px] font-extrabold tabular-nums mt-1 truncate', cls)}>{value}</div>
              </div>
            ))}
          </div>

          <section>
            <h3 className="font-mono text-[10px] font-semibold tracking-[0.15em] uppercase text-accent mb-2">Details</h3>
            <dl className="grid grid-cols-[120px_1fr] text-[13px]">
              {details.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="py-2.5 border-b border-white/[0.05] text-text-muted">{k}</dt>
                  <dd className="py-2.5 border-b border-white/[0.05] text-text-primary min-w-0 flex items-center">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="font-mono text-[10px] font-semibold tracking-[0.15em] uppercase text-accent mb-2">Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Context, sub-scope, internal notes… (saves when you click away)"
            />
          </section>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3.5 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
          <Button variant="danger" onClick={onMarkLost}>
            Mark lost
          </Button>
          <Button variant="secondary" onClick={onEdit} className="ml-auto">
            Edit deal
          </Button>
          {next && (
            <Button variant="primary" onClick={() => onMove(next)}>
              {next.id === 'won' ? 'Mark as won →' : `Move to ${next.name} →`}
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
