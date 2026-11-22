import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Terminal, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export function DebugConsole() {
  const { debugLogs, clearDebugLogs } = useToast();
  const [open, setOpen] = useState(true);

  const isDebugEnabled =
    typeof window !== 'undefined' &&
    (window.location.search.includes('debug=1') || window.location.hash.includes('debug=1'));

  if (!isDebugEnabled) return null;

  return (
    <aside className="fixed bottom-20 left-4 z-40 w-[min(92vw,420px)] rounded-3xl border border-[var(--line)] bg-[var(--navy)] text-white shadow-2xl lg:bottom-6">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--sun)]">
          <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
          Supabase debug ({debugLogs.length})
        </span>
        <div className="flex items-center gap-1">
          {debugLogs.length > 0 && (
            <button
              type="button"
              onClick={clearDebugLogs}
              aria-label="Clear debug logs"
              className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Collapse debug panel' : 'Expand debug panel'}
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="max-h-56 space-y-2 overflow-y-auto p-3 text-xs">
          {debugLogs.length === 0 ? (
            <p className="text-white/75">No Supabase errors recorded in this session.</p>
          ) : (
            debugLogs.map((log) => (
              <div key={log.id} className="rounded-2xl bg-white/10 p-2.5">
                <div className="flex items-center justify-between text-[11px] text-[var(--sun)]">
                  <span className="font-bold">{log.context}</span>
                  <span>{log.time}</span>
                </div>
                <p className="mt-1 break-words font-mono text-[11px] text-white/95">
                  {log.message}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
