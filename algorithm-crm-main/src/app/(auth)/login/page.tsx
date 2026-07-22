'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push('/deals');
    router.refresh();
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
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Sign in</h1>
        <p className="text-sm text-text-muted mb-6">Welcome back.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="you@agency.com"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-deep-navy border border-white/10 rounded-lg text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-sm text-priority-high bg-priority-high/10 border border-priority-high/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-gradient text-deep-navy font-semibold rounded-pill hover:brightness-110 transition disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          No account?{' '}
          <Link href="/signup" className="text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
