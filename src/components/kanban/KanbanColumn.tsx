'use client';

import { useDroppable } from '@dnd-kit/core';
import type { DealStage, Deal, Contact, Company, Profile, Currency } from '@/types';
import { annualisedValue, weightedValue, fmtCurrency, CURRENCY_SYMBOLS } from '@/types';
import DealCard from './DealCard';
import { cn } from '@/lib/utils';

interface Props {
  stage: DealStage;
  deals: Deal[];
  contacts: Contact[];
  companies: Company[];
  profiles: Profile[];
  onCardClick: (d: Deal) => void;
  onHide?: () => void; // undefined when this is the last visible column
}

function money(v: number, currency: Currency) {
  return v > 0 ? fmtCurrency(v, currency) : `${CURRENCY_SYMBOLS[currency]}0`;
}

export default function KanbanColumn({ stage, deals, contacts, companies, profiles, onCardClick, onHide }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const currency = deals[0]?.currency || 'ZAR';
  const total = deals.reduce((s, d) => s + annualisedValue(d), 0);

  let sub: string;
  if (stage.early) sub = 'unvalued';
  else if (stage.id === 'won')
    sub = `${money(deals.reduce((s, d) => s + (Number(d.monthly_value) || 0), 0), currency)}/mo MRR`;
  else if (stage.id === 'lost') sub = 'closed lost';
  else sub = `${money(deals.reduce((s, d) => s + weightedValue(d), 0), currency)} weighted · ${stage.prob}%`;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border rounded-xl flex flex-col overflow-hidden min-w-0 min-h-0 transition-colors',
        isOver ? 'bg-slate' : 'bg-navy border-white/[0.06]',
      )}
      style={isOver ? { borderColor: stage.color } : undefined}
    >
      <div className="h-[2px] opacity-80 flex-shrink-0" style={{ background: stage.color }} />
      <div className="px-3.5 py-3 border-b border-white/[0.06] flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="font-mono text-[10px] font-semibold tracking-[0.15em] uppercase"
          style={{ color: stage.color }}
        >
          {stage.name}
        </span>
        <span className="font-mono text-[10px] bg-white/5 text-text-sub rounded-md px-1.5">{deals.length}</span>
        <span className="ml-auto text-[15px] font-bold tabular-nums">{stage.early ? '' : money(total, currency)}</span>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="text-text-muted hover:text-text-primary -mr-1 p-0.5 rounded"
            aria-label={`Hide ${stage.name}`}
            title={`Hide ${stage.name}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <div className="basis-full font-mono text-[10px] text-text-muted">{sub}</div>
      </div>
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 grid gap-2 content-start"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
      >
        {deals.length === 0 ? (
          <div className="col-span-full min-h-[120px] border border-dashed border-white/[0.08] rounded-lg flex items-center justify-center text-[11.5px] text-text-muted">
            Drop deals here
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              contacts={contacts}
              companies={companies}
              profiles={profiles}
              onClick={() => onCardClick(deal)}
            />
          ))
        )}
      </div>
    </div>
  );
}
