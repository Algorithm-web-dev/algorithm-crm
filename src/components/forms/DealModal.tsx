'use client';

import { useState } from 'react';
import {
  type Deal,
  type Contact,
  type Company,
  type DealStageId,
  type Priority,
  type Currency,
  type Profile,
  DEAL_STAGES,
  DEAL_SOURCES,
  CURRENCIES,
  LOSS_REASONS,
  isEarlyStage,
  profileName,
} from '@/types';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { Input, Select, Textarea, Label, Button, PriorityPicker } from '@/components/ui/Form';
import { toast } from '@/components/ui/Toaster';
import { cn } from '@/lib/utils';

interface Props {
  deal: Deal | null;
  contacts: Contact[];
  companies: Company[];
  profiles: Profile[];
  currentUserId: string;
  defaultCurrency: Currency;
  onClose: () => void;
  onSaved: (deal: Deal) => void;
  onCompanyCreated: (company: Company) => void;
}

const NEW_COMPANY = '__new__';
// New deals start in an open stage (Won/Lost are reached by moving a deal)
const OPEN_STAGES = DEAL_STAGES.filter((s) => s.id !== 'won' && s.id !== 'lost');

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="font-mono text-[10px] font-semibold tracking-[0.15em] uppercase text-accent">{children}</h3>;
}

export default function DealModal({
  deal,
  contacts,
  companies,
  profiles,
  currentUserId,
  defaultCurrency,
  onClose,
  onSaved,
  onCompanyCreated,
}: Props) {
  const isEdit = !!deal;

  // Form state
  const [name, setName] = useState(deal?.name || '');
  const [stage, setStage] = useState<DealStageId>(deal?.deal_stage || 'inbox');
  const [source, setSource] = useState(deal?.source || 'Manual');
  const [priority, setPriority] = useState<Priority>(deal?.priority || 'Medium');
  const [notes, setNotes] = useState(deal?.notes || '');
  const [dealOwnerId, setDealOwnerId] = useState(deal?.deal_owner_id || currentUserId);
  const [lossReason, setLossReason] = useState<string>(deal?.loss_reason || LOSS_REASONS[0]);

  // Early-stage fields
  const [leadFirstName, setLeadFirstName] = useState(deal?.lead_first_name || '');
  const [leadLastName, setLeadLastName] = useState(deal?.lead_last_name || '');
  const [leadEmail, setLeadEmail] = useState(deal?.lead_email || '');
  const [leadCompanyName, setLeadCompanyName] = useState(deal?.lead_company_name || '');

  // Later-stage fields
  const [companyId, setCompanyId] = useState(deal?.company_id || '');
  const [newCompanyName, setNewCompanyName] = useState(deal?.lead_company_name || deal?.name || '');
  const [contactId, setContactId] = useState(deal?.primary_contact_id || '');
  const [monthlyValue, setMonthlyValue] = useState(String(deal?.monthly_value || 0));
  const [oneOffValue, setOneOffValue] = useState(String(deal?.one_off_value || 0));
  const [currency, setCurrency] = useState<Currency>(deal?.currency || defaultCurrency);
  const [expectedClose, setExpectedClose] = useState(deal?.expected_close_date || '');

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const early = isEarlyStage(stage);
  const isLost = stage === 'lost';
  const stageChanged = isEdit && deal.deal_stage !== stage;
  // A lead that never got a company keeps its prospect fields when marked Lost —
  // closing out a lead must not require (or wipe) company/contact data.
  const leadLayout = early || (isLost && !deal?.company_id);
  const companyRequired = !leadLayout && !isLost;

  async function handleSave() {
    setSubmitted(true);
    if (!name.trim()) {
      toast('Deal name required', 'error');
      return;
    }
    if (!dealOwnerId) {
      toast('Deal owner required', 'error');
      return;
    }
    if (companyId === NEW_COMPANY && !newCompanyName.trim()) {
      toast('Enter a name for the new company', 'error');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast('Not signed in', 'error');
      setLoading(false);
      return;
    }

    const patch: Record<string, unknown> = {
      name: name.trim(),
      deal_stage: stage,
      source,
      priority,
      notes,
      deal_owner_id: dealOwnerId,
      last_activity_at: new Date().toISOString(),
    };

    if (isLost) {
      patch.loss_reason = lossReason;
      if (stageChanged || !deal?.actual_close_date) {
        patch.actual_close_date = new Date().toISOString().split('T')[0];
      }
    } else if (stage === 'won') {
      patch.loss_reason = null;
      if (stageChanged || !deal?.actual_close_date) {
        patch.actual_close_date = new Date().toISOString().split('T')[0];
      }
    } else if (deal?.deal_stage === 'lost' || deal?.deal_stage === 'won') {
      // Re-opened from a closed stage
      patch.loss_reason = null;
      patch.actual_close_date = null;
    }

    if (leadLayout) {
      patch.lead_first_name = leadFirstName.trim() || null;
      patch.lead_last_name = leadLastName.trim() || null;
      patch.lead_email = leadEmail.trim() || null;
      patch.lead_company_name = leadCompanyName.trim() || null;
      if (early) {
        patch.monthly_value = 0;
        patch.one_off_value = 0;
        patch.company_id = null;
        patch.primary_contact_id = null;
      }
    } else {
      let resolvedCompanyId = companyId;
      if (companyId === NEW_COMPANY) {
        const { data, error } = await supabase
          .from('companies')
          .insert({ name: newCompanyName.trim(), owner_id: user.id })
          .select()
          .single();
        if (error) {
          toast(error.message || 'Company create failed', 'error');
          setLoading(false);
          return;
        }
        resolvedCompanyId = data.id;
        setCompanyId(data.id);
        onCompanyCreated(data as Company);
      }
      if (companyRequired && !resolvedCompanyId) {
        toast('Company required for this stage — pick one or create a new one', 'error');
        setLoading(false);
        return;
      }
      patch.company_id = resolvedCompanyId || null;
      patch.primary_contact_id = contactId || null;
      patch.monthly_value = parseFloat(monthlyValue) || 0;
      patch.one_off_value = parseFloat(oneOffValue) || 0;
      patch.currency = currency;
      patch.expected_close_date = expectedClose || null;
      // Clear lead_* on full deal
      patch.lead_first_name = null;
      patch.lead_last_name = null;
      patch.lead_email = null;
      patch.lead_company_name = null;
    }

    let saved: Deal | null = null;
    if (isEdit && deal) {
      const { data, error } = await supabase
        .from('deals')
        .update(patch)
        .eq('id', deal.id)
        .select()
        .single();
      if (error) {
        toast(error.message || 'Save failed', 'error');
        setLoading(false);
        return;
      }
      saved = data as Deal;

      if (stageChanged) {
        const stageName = DEAL_STAGES.find((s) => s.id === stage)?.name;
        await supabase.from('activities').insert({
          owner_id: user.id,
          deal_id: saved.id,
          company_id: saved.company_id,
          contact_id: saved.primary_contact_id,
          type: 'stage',
          title: isLost ? `Deal lost — ${lossReason}` : `Stage → ${stageName}`,
          body: `Moved from ${DEAL_STAGES.find((s) => s.id === deal.deal_stage)?.name} (via Edit Deal)`,
        });
      }
    } else {
      patch.owner_id = user.id;
      const { data, error } = await supabase.from('deals').insert(patch).select().single();
      if (error) {
        toast(error.message || 'Create failed', 'error');
        setLoading(false);
        return;
      }
      saved = data as Deal;

      await supabase.from('activities').insert({
        owner_id: user.id,
        deal_id: saved.id,
        company_id: saved.company_id,
        contact_id: saved.primary_contact_id,
        type: 'stage',
        title: 'Deal created',
        body: `In ${DEAL_STAGES.find((s) => s.id === stage)?.name}`,
      });
    }

    setLoading(false);
    toast(isEdit ? 'Saved' : 'Created', 'success');
    onSaved(saved);
  }

  const linkedFields = (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label required={companyRequired}>Company</Label>
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">{companyRequired ? 'Select company…' : 'No company'}</option>
            <option value={NEW_COMPANY}>+ Create new company…</option>
            {[...companies]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          {companyId === NEW_COMPANY && (
            <Input
              className="mt-2"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="New company name"
            />
          )}
        </div>
        <div>
          <Label>Primary contact</Label>
          <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Select contact…</option>
            {contacts
              .filter((c) => !companyId || companyId === NEW_COMPANY || c.company_id === companyId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
          </Select>
        </div>
      </div>

      <h3 className="font-mono text-xs font-semibold text-text-muted mb-3 mt-4 uppercase tracking-wider">
        Value
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <Label>Monthly</Label>
          <Input
            type="number"
            min="0"
            value={monthlyValue}
            onChange={(e) => setMonthlyValue(e.target.value)}
          />
        </div>
        <div>
          <Label>One-off</Label>
          <Input
            type="number"
            min="0"
            value={oneOffValue}
            onChange={(e) => setOneOffValue(e.target.value)}
          />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>Expected close</Label>
        <Input
          type="date"
          value={expectedClose}
          onChange={(e) => setExpectedClose(e.target.value)}
        />
      </div>
    </>
  );

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave} disabled={loading}>
        {loading ? 'Saving…' : isEdit ? 'Save' : 'Create Deal'}
      </Button>
    </>
  );

  // New Deal: two panels (deal on the left, prospect / linked records on the right)
  if (!isEdit) {
    return (
      <Modal title="New Deal" size="xl" onClose={onClose} footer={footer}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="p-4 sm:p-6 flex flex-col gap-4">
            <SectionLabel>Deal</SectionLabel>
            <div>
              <Label required>Deal name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme — Website Rebuild"
                autoFocus
                className={cn(submitted && !name.trim() && '!border-priority-high')}
              />
              <p className="text-xs text-text-muted mt-1">
                For early stages, this can be just the prospect or company name.
              </p>
            </div>
            <div>
              <Label>Stage</Label>
              <div className="flex flex-wrap gap-1.5">
                {OPEN_STAGES.map((s) => {
                  const selected = stage === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStage(s.id)}
                      aria-pressed={selected}
                      style={selected ? { background: `${s.color}26`, borderColor: s.color } : undefined}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
                        selected ? 'text-text-primary' : 'border-white/10 text-text-sub hover:text-text-primary',
                      )}
                    >
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Source</Label>
              <div className="flex flex-wrap gap-1.5">
                {DEAL_SOURCES.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSource(src)}
                    aria-pressed={source === src}
                    className={cn(
                      'px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
                      source === src
                        ? 'bg-accent/[0.12] border-accent/50 text-text-primary'
                        : 'border-white/10 text-text-sub hover:text-text-primary',
                    )}
                  >
                    {src}
                  </button>
                ))}
              </div>
            </div>
            {/* stacked: three priority pills don't fit beside the owner select at this width */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label required>Deal owner</Label>
                <Select value={dealOwnerId} onChange={(e) => setDealOwnerId(e.target.value)}>
                  {!dealOwnerId && <option value="">Select owner…</option>}
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {profileName(p)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <PriorityPicker value={priority} onChange={setPriority} />
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 bg-slate border-t sm:border-t-0 sm:border-l border-white/[0.06] flex flex-col gap-4">
            {early ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <SectionLabel>Prospect</SectionLabel>
                  <span className="text-[11px] text-text-muted">Early stage · optional</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First name</Label>
                    <Input value={leadFirstName} onChange={(e) => setLeadFirstName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Last name</Label>
                    <Input value={leadLastName} onChange={(e) => setLeadLastName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Company name</Label>
                  <Input value={leadCompanyName} onChange={(e) => setLeadCompanyName(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <SectionLabel>Linked records</SectionLabel>
                  <span className="text-[11px] text-text-muted">Required from Discovery on</span>
                </div>
                <div>{linkedFields}</div>
              </>
            )}
            <div className="flex-1 flex flex-col">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context, sub-scope, internal notes…"
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Edit Deal\"
      large
      onClose={onClose}
      footer={footer}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <Label>Stage</Label>
          <Select value={stage} onChange={(e) => setStage(e.target.value as DealStageId)}>
            {DEAL_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Source</Label>
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            {DEAL_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <Label required>Deal owner</Label>
          <Select value={dealOwnerId} onChange={(e) => setDealOwnerId(e.target.value)}>
            {!dealOwnerId && <option value="">Select owner…</option>}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {profileName(p)}
              </option>
            ))}
          </Select>
        </div>
        {isLost ? (
          <div>
            <Label required>Loss reason</Label>
            <Select value={lossReason} onChange={(e) => setLossReason(e.target.value)}>
              {LOSS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div />
        )}
      </div>

      <div className="mb-4">
        <Label required>Deal name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme — Website Rebuild"
          autoFocus
        />
        <p className="text-xs text-text-muted mt-1">
          For early stages, this can be just the prospect or company name.
        </p>
      </div>

      {leadLayout ? (
        <div className="mb-4 pt-4 border-t border-white/[0.06]">
          <h3 className="font-mono text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
            {early ? 'Prospect info (early stage)' : 'Prospect info'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <Label>First name</Label>
              <Input value={leadFirstName} onChange={(e) => setLeadFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={leadLastName} onChange={(e) => setLeadLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
            </div>
            <div>
              <Label>Company name</Label>
              <Input
                value={leadCompanyName}
                onChange={(e) => setLeadCompanyName(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 pt-4 border-t border-white/[0.06]">
          <h3 className="font-mono text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
            Linked records
          </h3>
          {linkedFields}
        </div>
      )}

      <div className="mb-4 pt-4 border-t border-white/[0.06]">
        <Label>Priority</Label>
        <PriorityPicker value={priority} onChange={setPriority} />
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context, sub-scope, internal notes…"
        />
      </div>
    </Modal>
  );
}
