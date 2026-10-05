'use client';

import { useDroppable } from '@dnd-kit/core';
import { type Deal, type Contact, annualisedValue, fmtCurrency } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  deals: Deal[];
  contacts: Contact[];
  onCardClick: (d: Deal) => void;
}

// Drop target for closing deals as Lost. Cards here aren't draggable —
// reopen from the Lost page or the Edit Deal form.
export default function LostColumn({ deals, contacts, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: 'lost' });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-none w-[230px] flex flex-col bg-navy border rounded-xl overflow-hidden transition-colors',
        isOver ? 'border-red-500 bg-red-500/5' : 'border-red-900/40',
      )}
    >
      <div className="px-3 py-2.5 border-b border-red-900/30 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
        <span className="font-mono text-[10px] font-semibold tracking-[0.15em] text-red-400">LOST</span>
        <span className="ml-auto font-mono text-[10px] text-red-400/60 px-1.5 py-0.5 rounded-lg bg-red-500/10">
          {deals.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {deals.length === 0 ? (
          <div className="text-center py-6 text-[11px] text-text-muted">Drop a deal here to mark it lost</div>
        ) : (
          deals.map((deal) => {
            const contact = contacts.find((c) => c.id === deal.primary_contact_id);
            const contactName = contact ? `${contact.first_name} ${contact.last_name ?? ''}`.trim() : null;
            return (
              <div
                key={deal.id}
                onClick={() => onCardClick(deal)}
                className="bg-slate-light border border-red-900/20 rounded-lg p-2.5 cursor-pointer hover:border-red-700/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span className="text-xs font-semibold text-text-primary leading-tight line-clamp-2">{deal.name}</span>
                  {annualisedValue(deal) > 0 && (
                    <span className="text-[10px] font-mono text-red-400 flex-shrink-0">
                      {fmtCurrency(annualisedValue(deal), deal.currency || 'ZAR')}
                    </span>
                  )}
                </div>
                {deal.loss_reason && <div className="text-[10px] text-red-400/70 mb-1.5">{deal.loss_reason}</div>}
                {contactName && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center text-[8px] font-bold text-red-400 flex-shrink-0">
                      {contactName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-text-muted truncate">{contactName}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
