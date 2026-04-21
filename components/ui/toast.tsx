'use client';

import * as React from 'react';

type ToastMsg = { id: number; title: string; description?: string; variant?: 'default' | 'destructive' };
type ToastCtx = { toast: (m: Omit<ToastMsg, 'id'>) => void };

const Ctx = React.createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msgs, setMsgs] = React.useState<ToastMsg[]>([]);
  const idRef = React.useRef(0);

  const toast = React.useCallback((m: Omit<ToastMsg, 'id'>) => {
    const id = ++idRef.current;
    setMsgs((prev) => [...prev, { id, ...m }]);
    setTimeout(() => setMsgs((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-80 max-w-full flex-col gap-2">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`rounded-md border p-3 shadow-md text-sm ${
              m.variant === 'destructive' ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border bg-background'
            }`}
          >
            <div className="font-semibold">{m.title}</div>
            {m.description ? <div className="mt-1 opacity-90 whitespace-pre-wrap text-xs">{m.description}</div> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}
