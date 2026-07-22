'use client';

import { useState } from 'react';
import { CURRENCIES, type Currency, type Profile } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { Input, Select, Label, Button } from '@/components/ui/Form';
import Toaster, { toast } from '@/components/ui/Toaster';

interface Props {
  profile: Profile;
  email: string;
}

export default function SettingsForm({ profile, email }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [currency, setCurrency] = useState<Currency>(profile?.default_currency || 'ZAR');
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        default_currency: currency,
      })
      .eq('id', profile.id);
    setLoading(false);
    if (error) {
      toast('Save failed', 'error');
    } else {
      toast('Saved', 'success');
    }
  }

  return (
    <>
      <div className="bg-slate-light border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-lg font-extrabold mb-1">Your profile</h2>
        <p className="text-sm text-text-muted mb-5">These details appear on activity and your account.</p>

        <div className="space-y-4">
          <div>
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} disabled className="opacity-60" />
            <p className="text-xs text-text-muted mt-1">Email is set at sign-up and can&apos;t be changed here.</p>
          </div>
          <div>
            <Label>Default currency</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="primary" onClick={save} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <Toaster />
    </>
  );
}
