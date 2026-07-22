'use client';

import { useState } from 'react';
import {
  type Deal,
  type Contact,
  type Company,
  type DealStageId,
  type Priority,
  type Currency,
  DEAL_STAGES,
  DEAL_SOURCES,
  CURRENCIES,
  isEarlyStage,
} from '@/types';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { Input, Select, Textarea, Label, Button, PriorityPicker } from '@/components/ui/Form';
import { toast } from '@/components/ui/Toaster';

interface Props {
  deal: Deal | null;
  contacts: Contact[];
  companies: Company[];
  defaultCurrency: Currency;
  onClose: () => void;
  onSaved: (deal: Deal) => void;
}

export default function DealModal({ deal, contacts, companies, defaultCurrency, onClose, onSaved }: Props) {
  const isEdit = !!deal;

  // Form state
  const [name, setName] = useState(deal?.name || '');
  const [stage, setStage] = useState<DealStageId>(deal?.deal_stage || 'inbox');
  const [source, setSource] = useState(deal?.source || 'Manual');
  const [priority, setPriority] = useState<Priority>(deal?.priority || 'Medium');
  const [notes, setNotes] = useState(deal?.notes || '');

  // Early-stage fields
  const [leadFirstName, setLeadFirstName] = useState(deal?.lead_first_name || '');
  const [leadLastName, setLeadLastName] = useState(deal?.lead_last_name || '');
  const [leadEmail, setLeadEmail] = useState(deal?.lead_email || '');
  const [leadCompanyName, setLeadCompanyName] = useState(deal?.lead_company_name || '');

  // Later-stage fields
  const [companyId, setCompanyId] = useState(deal?.company_id || '');
  const [contactId, setContactId] = useState(deal?.primary_contact_id || '');
  const [monthlyValue, setMonthlyValue] = useState(String(deal?.monthly_value || 0));
  const [oneOffValue, setOneOffValue] = useState(String(deal?.one_off_value || 0));
  const [currency, setCurrency] = useState<Currency>(deal?.currency || defaultCurrency);
  const [expectedClose, setExpectedClose] = useState(deal?.expected_close_date || '');

  const [loading, setLoading] = useState(false);

  const early = isEarlyStage(stage);

  async function handleSave() {
    if (!name.trim()) {
      toast('Deal name required', 'error');
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
      last_activity_at: new Date().toISOString(),
    };

    if (early) {
      patch.lead_first_name = leadFirstName.trim() || null;
      patch.lead_last_name = leadLastName.trim() || null;
      patch.lead_email = leadEmail.trim() || null;
      patch.lead_company_name = leadCompanyName.trim() || null;
      patch.monthly_value = 0;
      patch.one_off_value = 0;
      patch.company_id = null;
      patch.primary_contact_id = null;
    } else {
      if (!companyId) {
        toast('Company required for this stage', 'error');
        setLoading(false);
        return;
      }
      patch.company_id = companyId;
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
        toast('Save failed', 'error');
        setLoading(false);
        return;
      }
      saved = data as Deal;
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

  return (
    <Modal
      title={isEdit ? 'Edit Deal' : 'New Deal'}
      large
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : isEdit ? 'Save' : 'Create Deal'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-4">
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

      {early ? (
        <div className="mb-4 pt-4 border-t border-white/[0.06]">
          <h3 className="font-mono text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
            Prospect info (early stage)
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <Label>First name</Label>
              <Input value={leadFirstName} onChange={(e) => setLeadFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={leadLastName} onChange={(e) => setLeadLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <Label required>Company</Label>
              <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">Select company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Primary contact</Label>
              <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">Select contact…</option>
                {contacts
                  .filter((c) => !companyId || c.company_id === companyId)
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
          <div className="grid grid-cols-3 gap-3 mb-3">
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
