'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  large?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ title, subtitle, large, onClose, children, footer }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-slate-light border border-white/[0.06] rounded-2xl shadow-2xl w-full max-h-[88vh] overflow-y-auto',
          large ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-start gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1 rounded">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-3 border-t border-white/[0.06] flex justify-end gap-2 bg-deep-navy/40 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
