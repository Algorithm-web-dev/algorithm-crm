'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  large?: boolean;
  // xl: 820px wide two-panel layout (New Deal); body padding handled by caller
  size?: 'xl';
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ title, subtitle, large, size, onClose, children, footer }: Props) {
  const xl = size === 'xl';
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className={cn(
        'fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4',
        xl ? 'bg-deep-navy/70' : 'bg-black/60',
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-slate-light border border-white/[0.06] rounded-t-2xl sm:rounded-2xl w-full max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto',
          xl ? 'max-w-[820px] shadow-glow-blue-lg' : cn('shadow-2xl', large ? 'max-w-3xl' : 'max-w-xl'),
        )}
      >
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/[0.06] flex justify-between items-start gap-4">
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
        {xl ? children : <div className="px-4 sm:px-6 py-4 sm:py-5">{children}</div>}
        {footer && (
          <div className={`px-4 sm:px-6 py-3 border-t border-white/[0.06] flex flex-wrap justify-end gap-2 sm:rounded-b-2xl ${xl ? 'bg-slate' : 'bg-deep-navy/40'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
