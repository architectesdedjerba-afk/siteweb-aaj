/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Minimal toast system (no external deps).
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
};

const STYLES: Record<ToastKind, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-aaj-soft text-aaj-royal border-aaj-royal/20',
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => remove(id), 5000);
    },
    [remove]
  );

  const value: ToastContextValue = {
    toast,
    success: (m) => toast('success', m),
    error: (m) => toast('error', m),
    info: (m) => toast('info', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="fixed top-20 right-4 z-[200] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`${STYLES[t.kind]} border rounded px-4 py-3 text-sm font-medium shadow-lg flex items-start gap-3`}
            >
              <span className="shrink-0 mt-0.5">{ICONS[t.kind]}</span>
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                aria-label="Fermer"
                className="shrink-0 opacity-60 hover:opacity-100"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
