'use client';

import { useState } from 'react';
import {
  type Deal,
  type Contact,
  type Company,
  type DealStageId,
  type Currency,
  DEAL_STAGES,
  CURRENCIES,
} from '@/types';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { Input, Select, Label, Button } from '@/components/ui/Form';
import { toast } from '@/components/ui/Toaster';

interface Props {
  deal: Deal;
  newStage: DealStageId;
  contacts: Contact[];
  companies: Company[];
  onClose: () => void;
  onComplete: (result: { deal: Deal; contact?: Contact; company?: Company }) => void;
}

export default function PromoteModal({ deal, newStage, contacts, companies, onClose, onComplete }: Props) {
  const newStageName = DEAL_STAGES.find((s) => s.id === newStage)?.name || newStage;

  // Try to match existing company by name
  const companyMatch = deal.lead_company_name
    ? companies.find((c) => c.name.toLowerCase() === deal.lead_company_name!.toLowerCase())
    : null;

  // Try to match existing contact by email
  const contactMatch = deal.lead_email
    ? contacts.find((c) => c.email.toLowerCase() === deal.lead_email!.toLowerCase())
    : null;

  const [first, setFirst] = useState(deal.lead_first_name || '');
  const [last, setLast] = useState(deal.lead_last_name || '');
  const [email, setEmail] = useState(deal.lead_email || '');
  const [role, setRole] = useState(deal.lead_role || '');
  const [companyName, setCompanyName] = useState(deal.lead_company_name || '');
  const [monthly, setMonthly] = useState('0');
  const [oneOff, setOneOff] = useState('0');
  const [currency, setCurrency] = useState<Currency>((deal.currency as Currency) || 'ZAR');
  const [closeDate, setCloseDate] = useState(deal.expected_close_date || '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
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

    // Resolve / create company
    let companyId = companyMatch?.id;
    let createdCompany: Company | undefined;
    if (!companyId) {
      const name = companyName.trim() || deal.lead_company_name || 'Unnamed Company';
      const { data, error } = await supabase
        .from('companies')
        .insert({ name, owner_id: user.id })
        .select()
        .single();
      if (error) {
        toast('Company create failed', 'error');
        setLoading(false);
        return;
      }
      companyId = data.id;
      createdCompany = data as Company;
    }

    // Resolve / create contact
    let contactId = contactMatch?.id;
    let createdContact: Contact | undefined;
    if (!contactId) {
      if (!first.trim()) {
        toast('First name required', 'error');
        setLoading(false);
        return;
      }
      if (!email.trim()) {
        toast('Email required', 'error');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          owner_id: user.id,
          company_id: companyId,
          first_name: first.trim(),
          last_name: last.trim() || null,
          email: email.trim(),
          role_title: role.trim() || null,
        })
        .select()
        .single();
      if (error) {
        toast(error.message || 'Contact create failed', 'error');
        setLoading(false);
        return;
      }
      contactId = data.id;
      createdContact = data as Contact;
    }

    // Update deal: link records, set value, clear lead_*, move stage
    const patch = {
      company_id: companyId,
      primary_contact_id: contactId,
      monthly_value: parseFloat(monthly) || 0,
      one_off_value: parseFloat(oneOff) || 0,
      currency,
      expected_close_date: closeDate || null,
      deal_stage: newStage,
      last_activity_at: new Date().toISOString(),
      lead_first_name: null,
      lead_last_name: null,
      lead_email: null,
      lead_company_name: null,
      lead_role: null,
    };
    const { data: updatedDeal, error: updErr } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', deal.id)
      .select()
      .single();
    if (updErr) {
      toast('Deal update failed', 'error');
      setLoading(false);
      return;
    }

    await supabase.from('activities').insert({
      owner_id: user.id,
      deal_id: deal.id,
      contact_id: contactId,
      company_id: companyId,
      type: 'stage',
      title: `Promoted to ${newStageName}`,
      body: 'Contact and Company records created.',
    });

    setLoading(false);
    toast('Promoted ✓', 'success');
    onComplete({
      deal: updatedDeal as Deal,
      contact: createdContact,
      company: createdCompany,
    });
  }

  return (
    <Modal
      title={`Promote to ${newStageName}`}
      subtitle="Set up a proper Contact & Company so you can track this deal"
      large
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Promoting…' : `Promote to ${newStageName}`}
          </Button>
        </>
      }
    >
      <div className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-2.5 text-xs text-accent mb-5">
        You&apos;re moving this out of early stages. Let&apos;s create clean Contact and Company records — and fill in the deal value.
      </div>

      {/* CONTACT */}
      <div className="mb-5">
        <h3 className="font-mono text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
          Contact
        </h3>
        {contactMatch ? (
          <div className="px-3 py-2.5 bg-accent-2/10 border border-accent-2/30 rounded-lg text-xs text-accent-2">
            ✓ Matched existing contact: <strong>{contactMatch.first_name} {contactMatch.last_name}</strong>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label required>First name</Label>
                <Input value={first} onChange={(e) => setFirst(e.target.value)} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={last} onChange={(e) => setLast(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* COMPANY */}
      <div className="mb-5 pt-5 border-t border-white/[0.06]">
        <h3 className="font-mono text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
          Company
        </h3>
        {companyMatch ? (
          <div className="px-3 py-2.5 bg-accent-2/10 border border-accent-2/30 rounded-lg text-xs text-accent-2">
            ✓ Matched existing company: <strong>{companyMatch.name}</strong>
          </div>
        ) : (
          <div>
            <Label required>Company name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
        )}
      </div>

      {/* VALUE */}
      <div className="pt-5 border-t border-white/[0.06]">
        <h3 className="font-mono text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
          Deal value
        </h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <Label>Monthly</Label>
            <Input type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </div>
          <div>
            <Label>One-off</Label>
            <Input type="number" min="0" value={oneOff} onChange={(e) => setOneOff(e.target.value)} />
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
          <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
