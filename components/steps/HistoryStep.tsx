'use client';

import { useState } from 'react';

export interface HistoryRow {
  id: string;
  outgoing: boolean;
  label: string;
  time: string;
  counterparty: string;
  amountLabel: string;
}

export function HistoryStep({
  disabled,
  loading,
  history,
  error,
}: {
  disabled: boolean;
  loading: boolean;
  history: HistoryRow[];
  error: string;
}) {
  const [search, setSearch] = useState('');

  if (disabled) {
    return <p className="mt-2 text-[14.5px] text-[var(--qf-text-4)]">Connect a wallet to see your history.</p>;
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? history.filter(
        (tx) =>
          tx.counterparty.toLowerCase().includes(q) ||
          tx.label.toLowerCase().includes(q) ||
          tx.amountLabel.toLowerCase().includes(q)
      )
    : history;

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-[18px] flex-wrap">
        <h2 className="font-poppins font-semibold text-[21px] text-[var(--qf-text-1)]">
          Recent activity
        </h2>
        {!loading && !error && history.length > 0 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-[110px] focus:w-[150px] transition-[width] box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-full py-1.5 px-3 text-[12px] text-[var(--qf-text-1)] placeholder-[var(--qf-text-4)] focus:outline-none"
          />
        )}
      </div>
      {loading ? (
        <div className="flex flex-col gap-2.5">
          <div className="h-[58px] rounded-2xl qf-shimmer-bg" />
          <div className="h-[58px] rounded-2xl qf-shimmer-bg" />
          <div className="h-[58px] rounded-2xl qf-shimmer-bg" />
        </div>
      ) : error ? (
        <p className="text-[13px] text-[#EF4444] leading-relaxed">{error}</p>
      ) : history.length === 0 ? (
        <p className="text-[14px] text-[var(--qf-text-3)]">No activity yet — send or receive to start your log.</p>
      ) : filtered.length === 0 ? (
        <p className="text-[14px] text-[var(--qf-text-3)]">No transactions match "{search}".</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 bg-[var(--qf-card-bg-soft)] border border-[var(--qf-card-border-soft)] rounded-2xl py-[13px] px-[15px] animate-qf-fadeup"
            >
              <div
                className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-base opacity-85"
                style={{
                  background: tx.outgoing
                    ? 'var(--qf-secondary)'
                    : 'linear-gradient(135deg,var(--qf-accent-1),var(--qf-accent-2))',
                }}
              >
                {tx.outgoing ? '↗️' : '↘️'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-[var(--qf-text-1)] font-medium">{tx.label}</p>
                <p className="text-xs text-[var(--qf-text-3)]">
                  {tx.time} · {tx.counterparty}
                </p>
              </div>
              <p
                className="font-poppins font-semibold text-[14.5px]"
                style={{ color: tx.outgoing ? 'var(--qf-text-2)' : 'var(--qf-text-1)' }}
              >
                {tx.amountLabel}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
