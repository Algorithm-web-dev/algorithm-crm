'use client';

import { useDraggable } from '@dnd-kit/core';
import type { Deal, Contact, Company } from '@/types';
import { annualisedValue, fmtCurrency, isEarlyStage, daysBetween, initialsOf } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  deal: Deal;
  contacts: Contact[];
  companies: Company[];
  onClick?: () => void;
  dragging?: boolean;
}

export default function DealCard({ deal, contacts, companies, onClick, dragging }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });

  const company = deal.company_id ? companies.find((c) => c.id === deal.company_id) : null;
  const companyDisplay = company?.name || deal.lead_company_name || '—';
  const contact = deal.primary_contact_id ? contacts.find((c) => c.id === deal.primary_contact_id) : null;
  const contactName = contact
    ? `${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}`
    : deal.lead_first_name
    ? `${deal.lead_first_name}${deal.lead_last_name ? ' ' + deal.lead_last_name : ''}`
    : null;
  const contactInitials = contact
    ? initialsOf(contact.first_name, contact.last_name)
    : deal.lead_first_name
    ? initialsOf(deal.lead_first_name, deal.lead_last_name)
    : null;

  const early = isEarlyStage(deal.deal_stage);
  const annual = annualisedValue(deal);
  const daysSinceActivity = daysBetween(deal.last_activity_at);
  const daysInStage = daysBetween(deal.stage_entered_at);

  const priorityClass =
    deal.priority === 'High'
      ? 'border-l-priority-high'
      : deal.priority === 'Medium'
      ? 'border-l-priority-medium'
      : 'border-l-priority-low';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Don't open detail if it's a drag
        if (!isDragging) onClick?.();
      }}
      className={cn(
        'bg-slate-light border border-white/[0.06] rounded-lg px-2.5 py-2.5 cursor-grab transition-all',
        'border-l-[3px]',
        priorityClass,
        'hover:border-white/15 hover:shadow-glow-blue',
        (isDragging || dragging) && 'opacity-40',
      )}
    >
      <div className="flex justify-between gap-2 mb-0.5">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[12px] text-text-primary leading-tight tracking-tight truncate">
            {companyDisplay}
          </div>
          <div className="text-[11px] text-text-muted leading-tight truncate mt-0.5">
            {deal.name}
          </div>
        </div>
        {early ? (
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-accent font-medium">
              {deal.source || '—'}
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="text-[14px] font-extrabold tabular-nums leading-none">
              {fmtCurrency(annual, deal.currency)}
            </div>
            {deal.monthly_value > 0 && (
              <div className="font-mono text-[9px] text-text-muted mt-0.5 tabular-nums">
                {fmtCurrency(deal.monthly_value, deal.currency)}/mo
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-dashed border-white/[0.06] text-[10px] text-text-muted">
        {contactName ? (
          <>
            <div className="w-4 h-4 rounded-full bg-brand-gradient flex items-center justify-center text-deep-navy font-bold text-[8px]">
              {contactInitials}
            </div>
            <span className="truncate">{contactName}</span>
          </>
        ) : (
          <span className="font-mono text-[9px] tracking-[0.04em] uppercase text-text-muted">
            No contact
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {daysInStage != null && (
            <span
              className={cn(
                'font-mono text-[9px] px-1.5 py-0.5 rounded-md',
                daysInStage > 14
                  ? 'bg-priority-high/15 text-priority-high'
                  : daysInStage > 7
                  ? 'bg-priority-medium/15 text-priority-medium'
                  : 'bg-white/[0.04] text-text-muted',
              )}
              title="Days in current stage"
            >
              {daysInStage}d
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
