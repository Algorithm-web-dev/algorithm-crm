'use client';

import { cn } from '@/lib/utils';

export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5 font-mono">
      {children}
      {required && <span className="text-priority-high ml-0.5">*</span>}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-3 py-2 bg-deep-navy border border-white/10 rounded-lg text-sm transition-colors',
        'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full px-3 py-2 bg-deep-navy border border-white/10 rounded-lg text-sm transition-colors cursor-pointer',
        'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
        className,
      )}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full px-3 py-2 bg-deep-navy border border-white/10 rounded-lg text-sm transition-colors min-h-[80px] resize-y',
        'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
        className,
      )}
    />
  );
}

export function Button({
  variant = 'secondary',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return (
    <button
      {...props}
      className={cn(
        'px-4 py-2 rounded-pill font-semibold text-xs transition disabled:opacity-50 inline-flex items-center gap-1.5',
        variant === 'primary' && 'bg-brand-gradient text-deep-navy hover:brightness-110',
        variant === 'secondary' && 'bg-deep-navy border border-white/10 text-text-primary hover:bg-white/[0.04]',
        variant === 'danger' && 'bg-priority-high/15 border border-priority-high/30 text-priority-high hover:bg-priority-high/25',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PriorityPicker({
  value,
  onChange,
}: {
  value: 'High' | 'Medium' | 'Low';
  onChange: (v: 'High' | 'Medium' | 'Low') => void;
}) {
  const options: ('High' | 'Medium' | 'Low')[] = ['High', 'Medium', 'Low'];
  return (
    <div className="flex gap-1.5">
      {options.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            'flex-1 py-2 px-3 border rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5',
            value === p
              ? 'border-text-primary bg-white/[0.04]'
              : 'border-white/10 hover:border-white/20',
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              p === 'High' && 'bg-priority-high',
              p === 'Medium' && 'bg-priority-medium',
              p === 'Low' && 'bg-priority-low',
            )}
          />
          {p}
        </button>
      ))}
    </div>
  );
}
