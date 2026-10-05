'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
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
import ClosedLane from './ClosedLane';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';
import DealCard from './DealCard';
import DealModal from '@/components/forms/DealModal';
import PromoteModal from '@/components/forms/PromoteModal';
import LossModal from '@/components/forms/LossModal';
import ClosedDealModal from '@/components/forms/ClosedDealModal';
import Toaster, { toast } from '@/components/ui/Toaster';

interface Props {
  initialDeals: Deal[];
  contacts: Contact[];
  companies: Company[];
  profile: Profile;
  profiles: Profile[];
  currentUserId: string;
  openDealId?: string;
}

export default function DealsView({
  initialDeals,
  contacts: initialContacts,
  companies: initialCompanies,
  profile,
  profiles,
  currentUserId,
  openDealId,
}: Props) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // Opened via /deals?deal=<id> (e.g. from a notification). Closed deals open
  // as a read-only summary; open deals go straight to the edit form.
  const linkedDeal = (openDealId && initialDeals.find((d) => d.id === openDealId)) || null;
  const linkedIsClosed = linkedDeal?.deal_stage === 'won' || linkedDeal?.deal_stage === 'lost';
  const [editingDeal, setEditingDeal] = useState<Deal | null>(linkedIsClosed ? null : linkedDeal);
  const [viewingClosed, setViewingClosed] = useState<Deal | null>(linkedIsClosed ? linkedDeal : null);

  function openDeal(d: Deal) {
    if (d.deal_stage === 'won' || d.deal_stage === 'lost') setViewingClosed(d);
    else setEditingDeal(d);
  }
  const [creating, setCreating] = useState(false);
  const [promoting, setPromoting] = useState<{ deal: Deal; newStage: DealStageId } | null>(null);
  const [marking_lost, setMarkingLost] = useState<Deal | null>(null);

  // Mouse: drag after 5px. Touch: long-press (250ms) to drag, so swiping still scrolls the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  // Phones: every stage (incl. Won/Lost) is a full-width swipeable column.
  // Tablet+: Won/Lost are slim lanes pinned to the right of the board.
  const isPhone = useMediaQuery('(max-width: 767px)');
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

    // Lost requires a reason — checked before promotion so a lead can be
    // closed out without first creating Contact/Company records.
    if (newStage === 'lost') {
      setMarkingLost(deal);
      return;
    }

    // Promotion: early → not early, and no linked contact yet
    if (isEarlyStage(deal.deal_stage) && !isEarlyStage(newStage) && !deal.primary_contact_id) {
      setPromoting({ deal, newStage });
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
      <div className="flex items-center gap-3 px-3 sm:px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Deals</h1>
          <span className="hidden sm:inline text-xs text-text-muted truncate">Your unified pipeline</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/export/deals"
            title="Download all deals (value, owner, probability) as a CSV that opens in Excel"
            aria-label="Export CSV"
            className="px-3 sm:px-4 py-1.5 bg-deep-navy border border-white/10 text-text-primary font-semibold text-xs rounded-pill hover:bg-white/[0.04] transition inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden sm:inline">Export CSV</span>
          </a>
          <button
            onClick={() => setCreating(true)}
            className="px-3 sm:px-4 py-1.5 bg-brand-gradient text-deep-navy font-semibold text-xs rounded-pill hover:brightness-110 transition inline-flex items-center gap-1.5 whitespace-nowrap"
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:flex md:gap-0 px-3 sm:px-5 py-3 md:py-4 border-b border-white/[0.06]">
        <Metric label="Qualified Pipeline" value={fmtCurrencyFull(metrics.totalPipeline, profile?.default_currency || 'ZAR')} sub={`${metrics.qualifiedCount} deals · ${metrics.earlyCount} in early stages`} gradient />
        <Metric label="Weighted" value={fmtCurrencyFull(metrics.weighted, profile?.default_currency || 'ZAR')} sub="By stage probability" />
        <Metric label="Won 30d" value={fmtCurrencyFull(metrics.wonRecent, profile?.default_currency || 'ZAR')} sub="Annualised" highlight="success" />
        <Metric label="Active MRR" value={fmtCurrencyFull(metrics.activeMRR, profile?.default_currency || 'ZAR')} sub="From won retainers" />
      </div>

      {/* KANBAN */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 flex gap-2 3xl:gap-2.5 px-3 3xl:px-5 py-3 sm:py-4">
          {/* Open stages: stretch to fill; scroll sideways only when the screen is too narrow */}
          <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory md:snap-none scroll-px-3">
            <div className="flex gap-2 3xl:gap-2.5 h-full">
              {DEAL_STAGES.filter((s) => s.id !== 'won' && s.id !== 'lost').map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={deals.filter((d) => d.deal_stage === stage.id)}
                  contacts={contacts}
                  companies={companies}
                  profiles={profiles}
                  onCardClick={openDeal}
                  className={COLUMN_SIZE}
                />
              ))}
              {isPhone &&
                (['won', 'lost'] as const).map((kind) => (
                  <ClosedLane
                    key={kind}
                    kind={kind}
                    deals={deals.filter((d) => d.deal_stage === kind)}
                    profiles={profiles}
                    onCardClick={openDeal}
                    className={COLUMN_SIZE}
                  />
                ))}
            </div>
          </div>

          {/* Closed lanes: always visible on tablet and up */}
          {!isPhone &&
            (['won', 'lost'] as const).map((kind) => (
              <ClosedLane
                key={kind}
                kind={kind}
                deals={deals.filter((d) => d.deal_stage === kind)}
                profiles={profiles}
                onCardClick={openDeal}
                className="flex-none w-[132px] 3xl:w-[180px]"
              />
            ))}
        </div>
          <DragOverlay>
            {activeDeal ? (
              <DealCard deal={activeDeal} contacts={contacts} companies={companies} profiles={profiles} dragging />
            ) : null}
          </DragOverlay>
      </DndContext>

      {/* MODALS */}
      {(creating || editingDeal) && (
        <DealModal
          deal={editingDeal}
          contacts={contacts}
          companies={companies}
          profiles={profiles}
          currentUserId={currentUserId}
          defaultCurrency={profile?.default_currency || 'ZAR'}
          onCompanyCreated={(c) => setCompanies((prev) => [...prev, c])}
          onClose={() => {
            setCreating(false);
            setEditingDeal(null);
            if (openDealId) router.replace('/deals');
          }}
          onSaved={(d) => {
            if (editingDeal) onDealUpdated(d);
            else onDealCreated(d);
            setCreating(false);
            setEditingDeal(null);
            if (openDealId) router.replace('/deals');
          }}
        />
      )}

      {viewingClosed && (
        <ClosedDealModal
          deal={viewingClosed}
          companies={companies}
          contacts={contacts}
          profiles={profiles}
          isDirector={!!profile?.is_director}
          onClose={() => {
            setViewingClosed(null);
            if (openDealId) router.replace('/deals');
          }}
          onEdit={() => {
            setEditingDeal(viewingClosed);
            setViewingClosed(null);
          }}
          onUpdated={(d) => {
            onDealUpdated(d);
            setViewingClosed(null);
          }}
          onDeleted={(id) => {
            setDeals((prev) => prev.filter((d) => d.id !== id));
            setViewingClosed(null);
            if (openDealId) router.replace('/deals');
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

// Phone: one column per screen width (swipe). Tablet+: share the space, never
// narrower than 140px — all stages fit from ~1280px wide; below that the open
// stages scroll sideways while Won/Lost stay pinned.
const COLUMN_SIZE =
  'flex-none w-[85vw] max-w-[340px] snap-start md:flex-1 md:w-auto md:max-w-none md:min-w-[140px]';

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
    <div className="min-w-0 md:pr-6 md:mr-6 md:border-r border-white/[0.06] md:last:border-none md:last:mr-0">
      <div className="font-mono text-[9px] font-semibold tracking-[0.2em] text-text-muted mb-1 uppercase truncate">{label}</div>
      <div
        className={`text-lg sm:text-xl xl:text-2xl font-extrabold tracking-tight leading-none tabular-nums truncate ${
          gradient ? 'gradient-text' : highlight === 'success' ? 'text-accent-2' : 'text-text-primary'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-text-muted mt-1 truncate">{sub}</div>}
    </div>
  );
}
