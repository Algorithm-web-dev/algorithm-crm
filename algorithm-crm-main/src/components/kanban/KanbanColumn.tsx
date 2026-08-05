'use client';

import { useDroppable } from '@dnd-kit/core';
import type { DealStage, Deal, Contact, Company } from '@/types';
import { annualisedValue, fmtCurrency } from '@/types';
import DealCard from './DealCard';
import { cn } from '@/lib/utils';

interface Props {
  stage: DealStage;
  deals: Deal[];
  contacts: Contact[];
  companies: Company[];
  onCardClick: (d: Deal) => void;
}

export default function KanbanColumn({ stage, deals, contacts, companies, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const total = deals.reduce((s, d) => s + annualisedValue(d), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-none w-[230px] flex flex-col bg-navy border rounded-xl overflow-hidden transition-colors',
        isOver ? 'border-accent bg-accent/5' : 'border-white/[0.06]',
      )}
    >
      <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
        <span
          className="font-mono text-[10px] font-semibold tracking-[0.15em]"
          style={{ color: stage.color }}
        >
          {stage.name.toUpperCase()}
        </span>
        <span
          className="ml-auto font-mono text-[10px] text-text-muted px-1.5 py-0.5 rounded-lg"
          style={{ background: `${stage.color}1a` }}
        >
          {deals.length}
        </span>
        {total > 0 && (
          <span className="font-mono text-[9px] text-text-muted">{fmtCurrency(total, deals[0]?.currency || 'ZAR')}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            contacts={contacts}
            companies={companies}
            onClick={() => onCardClick(deal)}
          />
        ))}
        {deals.length === 0 && (
          <div className="text-center py-6 text-[11px] text-text-muted">No deals</div>
        )}
      </div>
    </div>
  );
}
