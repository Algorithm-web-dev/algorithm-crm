'use client';

import { useEffect, useState } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'default' | 'success' | 'error';
}

let listener: ((t: Toast) => void) | null = null;

export function toast(message: string, type: 'default' | 'success' | 'error' = 'default') {
  if (listener) {
    listener({ id: Math.random().toString(36), message, type });
  }
}

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    listener = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 2800);
    };
    return () => {
      listener = null;
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-lg font-medium text-sm shadow-2xl max-w-xs animate-in slide-in-from-right ${
            t.type === 'success'
              ? 'bg-accent-2 text-deep-navy'
              : t.type === 'error'
              ? 'bg-priority-high text-white'
              : 'bg-text-primary text-deep-navy'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
