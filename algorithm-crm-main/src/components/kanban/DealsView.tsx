'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  DEAL_STAGES,
  type Deal,
  type Contact,
  type Company,
  type DealStageId,
  type Profile,
  annualisedValue,
  weightedValue,
  fmtCurrency,
  fmtCurrencyFull,
  isEarlyStage,
  daysBetween,
} from '@/types';
import { createClient } from '@/lib/supabase/client';
import KanbanColumn from './KanbanColumn';
import DealCard from './DealCard';
import DealModal from '@/components/forms/DealModal';
import PromoteModal from '@/components/forms/PromoteModal';
import LossModal from '@/components/forms/LossModal';
import Toaster, { toast } from '@/components/ui/Toaster';

interface Props {
  initialDeals: Deal[];
  contacts: Contact[];
  companies: Company[];
  profile: Profile;
}

export default function DealsView({ initialDeals, contacts: initialContacts, companies: initialCompanies, profile }: Props) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [creating, setCreating] = useState(false);
  const [promoting, setPromoting] = useState<{ deal: Deal; newStage: DealStageId } | null>(null);
  const [marking_lost, setMarkingLost] = useState<Deal | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const supabase = createClient();

  // Metrics
  const metrics = useMemo(() => {
    const open = deals.filter((d) => d.deal_stage !== 'won' && d.deal_stage !== 'lost');
    const qualified = open.filter((d) => !isEarlyStage(d.deal_stage));
    const totalPipeline = qualified.reduce((s, d) => s + annualisedValue(d), 0);
    const weighted = qualified.reduce((s, d) => s + weightedValue(d), 0);
    const earlyCount = open.length - qualified.length;
    const wonRecent = deals
      .filter((d) => d.deal_stage === 'won' && (daysBetween(d.actual_close_date) ?? 999) < 30)
      .reduce((s, d) => s + annualisedValue(d), 0);
    const activeMRR = deals
      .filter((d) => d.deal_stage === 'won')
      .reduce((s, d) => s + (Number(d.monthly_value) || 0), 0);
    return { totalPipeline, weighted, qualifiedCount: qualified.length, earlyCount, wonRecent, activeMRR };
  }, [deals]);

  const activeDeal = activeDragId ? deals.find((d) => d.id === activeDragId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    if (!event.over) return;
    const dealId = String(event.active.id);
    const newStage = String(event.over.id) as DealStageId;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.deal_stage === newStage) return;

    // Promotion: early → not early, and no linked contact yet
    if (isEarlyStage(deal.deal_stage) && !isEarlyStage(newStage) && !deal.primary_contact_id) {
      setPromoting({ deal, newStage });
      return;
    }

    // Lost requires a reason
    if (newStage === 'lost') {
      setMarkingLost(deal);
      return;
    }

    // Won — confirm
    if (newStage === 'won') {
      if (!confirm(`Mark "${deal.name}" as WON?`)) return;
    }

    // Optimistic update
    const patch: Partial<Deal> = {
      deal_stage: newStage,
      last_activity_at: new Date().toISOString(),
    };
    if (newStage === 'won') patch.actual_close_date = new Date().toISOString().split('T')[0];

    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...patch } : d)));

    const { error } = await supabase.from('deals').update(patch).eq('id', dealId);
    if (error) {
      // rollback
      setDeals((prev) => prev.map((d) => (d.id === dealId ? deal : d)));
      toast('Update failed', 'error');
      return;
    }
    // Activity log
    await supabase.from('activities').insert({
      owner_id: deal.owner_id,
      deal_id: deal.id,
      contact_id: deal.primary_contact_id,
      company_id: deal.company_id,
      type: 'stage',
      title: `Stage → ${DEAL_STAGES.find((s) => s.id === newStage)?.name}`,
      body: `Moved from ${DEAL_STAGES.find((s) => s.id === deal.deal_stage)?.name}`,
    });
    toast(`${deal.name.slice(0, 30)} → ${DEAL_STAGES.find((s) => s.id === newStage)?.name}`, 'success');
  }

  function onDealCreated(d: Deal) {
    setDeals((prev) => [d, ...prev]);
  }
  function onDealUpdated(d: Deal) {
    setDeals((prev) => prev.map((x) => (x.id === d.id ? d : x)));
  }
  function onPromoteComplete(updated: { deal: Deal; contact?: Contact; company?: Company }) {
    setDeals((prev) => prev.map((d) => (d.id === updated.deal.id ? updated.deal : d)));
    if (updated.contact) setContacts((prev) => [...prev, updated.contact!]);
    if (updated.company) setCompanies((prev) => [...prev, updated.company!]);
    setPromoting(null);
  }

  return (
    <>
      {/* TOPBAR */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Deals</h1>
          <span className="text-xs text-text-muted">Your unified pipeline</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-1.5 bg-brand-gradient text-deep-navy font-semibold text-xs rounded-pill hover:brightness-110 transition inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Deal
          </button>
        </div>
      </div>

      {/* METRICS */}
      <div className="flex px-5 py-4 border-b border-white/[0.06]">
        <Metric label="Qualified Pipeline" value={fmtCurrencyFull(metrics.totalPipeline, profile?.default_currency || 'ZAR')} sub={`${metrics.qualifiedCount} deals · ${metrics.earlyCount} in early stages`} gradient />
        <Metric label="Weighted" value={fmtCurrencyFull(metrics.weighted, profile?.default_currency || 'ZAR')} sub="By stage probability" />
        <Metric label="Won 30d" value={fmtCurrencyFull(metrics.wonRecent, profile?.default_currency || 'ZAR')} sub="Annualised" highlight="success" />
        <Metric label="Active MRR" value={fmtCurrencyFull(metrics.activeMRR, profile?.default_currency || 'ZAR')} sub="From won retainers" />
      </div>

      {/* KANBAN */}
      <div className="flex-1 overflow-auto px-5 py-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-2.5 h-full min-w-min">
            {DEAL_STAGES.filter((s) => s.id !== 'lost').map((stage) => {
              const stageDeals = deals.filter((d) => d.deal_stage === stage.id);
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={stageDeals}
                  contacts={contacts}
                  companies={companies}
                  onCardClick={(d) => setEditingDeal(d)}
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeDeal ? (
              <DealCard deal={activeDeal} contacts={contacts} companies={companies} dragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* MODALS */}
      {(creating || editingDeal) && (
        <DealModal
          deal={editingDeal}
          contacts={contacts}
          companies={companies}
          defaultCurrency={profile?.default_currency || 'ZAR'}
          onClose={() => {
            setCreating(false);
            setEditingDeal(null);
          }}
          onSaved={(d) => {
            if (editingDeal) onDealUpdated(d);
            else onDealCreated(d);
            setCreating(false);
            setEditingDeal(null);
          }}
        />
      )}

      {promoting && (
        <PromoteModal
          deal={promoting.deal}
          newStage={promoting.newStage}
          contacts={contacts}
          companies={companies}
          onClose={() => setPromoting(null)}
          onComplete={onPromoteComplete}
        />
      )}

      {marking_lost && (
        <LossModal
          deal={marking_lost}
          onClose={() => setMarkingLost(null)}
          onComplete={(d) => {
            onDealUpdated(d);
            setMarkingLost(null);
          }}
        />
      )}

      <Toaster />
    </>
  );
}

function Metric({
  label,
  value,
  sub,
  gradient,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  gradient?: boolean;
  highlight?: 'success';
}) {
  return (
    <div className="pr-6 mr-6 border-r border-white/[0.06] last:border-none last:mr-0">
      <div className="font-mono text-[9px] font-semibold tracking-[0.2em] text-text-muted mb-1 uppercase">{label}</div>
      <div
        className={`text-2xl font-extrabold tracking-tight leading-none tabular-nums ${
          gradient ? 'gradient-text' : highlight === 'success' ? 'text-accent-2' : 'text-text-primary'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-text-muted mt-1">{sub}</div>}
    </div>
  );
}
