'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/deals`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If email confirmation is required, Supabase returns a user but no session.
    if (data.session) {
      router.push('/deals');
      router.refresh();
    } else {
      setInfo('Check your inbox to confirm your email, then sign in.');
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-10 justify-center">
        <div className="w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center text-deep-navy font-extrabold text-lg">
          A
        </div>
        <div className="text-2xl font-bold tracking-tight">
          Algorithm<span className="text-text-muted font-normal"> CRM</span>
        </div>
      </div>

      <div className="bg-slate-light border border-white/[0.06] rounded-2xl p-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Create account</h1>
        <p className="text-sm text-text-muted mb-6">Start tracking your pipeline.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 font-mono">
              Full name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 bg-deep-navy border border-white/10 rounded-lg text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 font-mono">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-deep-navy border border-white/10 rounded-lg text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 font-mono">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-deep-navy border border-white/10 rounded-lg text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
              autoComplete="new-password"
            />
            <p className="text-xs text-text-muted mt-1">At least 8 characters.</p>
          </div>

          {error && (
            <div className="text-sm text-priority-high bg-priority-high/10 border border-priority-high/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {info && (
            <div className="text-sm text-accent-2 bg-accent-2/10 border border-accent-2/20 rounded-lg px-3 py-2">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-gradient text-deep-navy font-semibold rounded-pill hover:brightness-110 transition disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
