'use client';

import { useDraggable } from '@dnd-kit/core';
import type { Deal, Contact, Company, Profile } from '@/types';
import { annualisedValue, fmtCurrency, isEarlyStage, daysBetween, initialsOf, profileName } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  deal: Deal;
  contacts: Contact[];
  companies: Company[];
  profiles: Profile[];
  onClick?: () => void;
}

// Draggable card on the board.
export default function DealCard({ onClick, ...props }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.deal.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onClick?.();
      }}
      className={cn('min-w-0', isDragging && 'opacity-40')}
    >
      <DealCardBody {...props} />
    </div>
  );
}

// Visual card, also used by the DragOverlay (which must not register a second draggable).
export function DealCardBody({ deal, contacts, companies, profiles }: Omit<Props, 'onClick'>) {
  const company = deal.company_id ? companies.find((c) => c.id === deal.company_id) : null;
  const companyDisplay = company?.name || deal.lead_company_name || deal.name;
  const contact = deal.primary_contact_id ? contacts.find((c) => c.id === deal.primary_contact_id) : null;
  const contactName = contact
    ? `${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}`
    : deal.lead_first_name
    ? `${deal.lead_first_name}${deal.lead_last_name ? ' ' + deal.lead_last_name : ''}`
    : null;
  const contactInitials = contact
    ? initialsOf(contact.first_name, contact.last_name)
    : initialsOf(deal.lead_first_name, deal.lead_last_name);
  const owner = profileName(profiles.find((p) => p.id === deal.deal_owner_id));

  const early = isEarlyStage(deal.deal_stage);
  const annual = annualisedValue(deal);
  const daysInStage = daysBetween(deal.stage_entered_at);

  const priorityClass =
    deal.priority === 'High'
      ? 'border-l-priority-high'
      : deal.priority === 'Medium'
      ? 'border-l-priority-medium'
      : 'border-l-priority-low';

  return (
    <div
      className={cn(
        'bg-slate-light border border-white/[0.06] border-l-[3px] rounded-[10px] px-3 py-[11px] flex flex-col gap-2.5 cursor-grab',
        'transition-[background-color,box-shadow] hover:bg-slate-hover hover:shadow-glow-blue',
        priorityClass,
      )}
    >
      <div className="flex gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-text-primary leading-tight truncate">{companyDisplay}</div>
          <div className="text-[11.5px] text-text-muted leading-tight truncate mt-0.5">{deal.name}</div>
        </div>
        {early ? (
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-accent font-medium flex-shrink-0 pt-0.5">
            {deal.source || '—'}
          </div>
        ) : (
          <div className="text-right flex-shrink-0">
            <div className="text-[14px] font-extrabold tabular-nums leading-tight">{fmtCurrency(annual, deal.currency)}</div>
            <div className="font-mono text-[9.5px] text-text-muted mt-0.5">
              {deal.monthly_value > 0
                ? `${fmtCurrency(deal.monthly_value, deal.currency)}/mo`
                : deal.one_off_value > 0
                ? 'one-off'
                : ''}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-text-sub min-w-0">
        {contactName ? (
          <>
            <span className="w-[18px] h-[18px] rounded-full bg-brand-gradient flex items-center justify-center text-deep-navy font-bold text-[8px] flex-shrink-0">
              {contactInitials}
            </span>
            <span className="truncate">{contactName}</span>
          </>
        ) : (
          <span className="font-mono text-[9px] tracking-[0.04em] uppercase text-text-muted">No contact</span>
        )}
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          <span
            className="font-mono text-[9.5px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent"
            title={`Deal owner: ${owner}`}
          >
            {initialsOf(owner.split(' ')[0], owner.split(' ')[1])}
          </span>
          {daysInStage != null && <DaysChip days={daysInStage} />}
        </span>
      </div>
    </div>
  );
}

export function DaysChip({ days }: { days: number }) {
  return (
    <span
      className={cn(
        'font-mono text-[9.5px] px-1.5 py-0.5 rounded-md',
        days > 14
          ? 'bg-priority-high/15 text-priority-high'
          : days > 7
          ? 'bg-priority-medium/15 text-priority-medium'
          : 'bg-white/[0.04] text-text-muted',
      )}
      title="Days in current stage"
    >
      {days}d
    </span>
  );
}
