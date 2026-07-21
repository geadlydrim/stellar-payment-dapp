'use client';

import type { TxStatus } from '@/lib/soroban';

interface TxStatusBannerProps {
  status: TxStatus | null;
  hash?: string;
  error?: string;
  successLabel?: string;
  pendingLabel?: string;
  explorerLink?: (hash: string) => string;
  onDismiss?: () => void;
}

export function TxStatusBanner({
  status,
  hash,
  error,
  successLabel = 'Confirmed on-chain',
  pendingLabel = 'Submitting transaction…',
  explorerLink,
  onDismiss,
}: TxStatusBannerProps) {
  if (!status) return null;

  if (status === 'pending') {
    return (
      <div className="mb-4 bg-[var(--qf-accent-1)]/10 border border-[var(--qf-accent-1)]/30 rounded-2xl p-3.5 text-[12.5px] text-[var(--qf-text-2)] flex items-center gap-2.5">
        <span
          className="w-[15px] h-[15px] rounded-full border-2 border-[var(--qf-accent-1)] border-r-transparent inline-block animate-spin flex-shrink-0"
        />
        <span>{pendingLabel}</span>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="mb-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-2xl p-3.5 text-[12.5px] text-[var(--qf-text-2)] relative">
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-2.5 right-3 border-none bg-transparent text-[var(--qf-text-3)] cursor-pointer text-sm"
          >
            ✕
          </button>
        )}
        <p className="mb-1 text-[#16A34A] font-semibold">✓ {successLabel}</p>
        {hash && (
          <>
            <p className="mb-1 font-mono break-all text-[var(--qf-text-2)]">
              Transaction hash: {hash}
            </p>
            {explorerLink && (
              <a
                href={explorerLink(hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#16A34A] underline break-all"
              >
                view on Stellar Expert →
              </a>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl p-3.5 text-[12.5px] text-[#EF4444] relative">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2.5 right-3 border-none bg-transparent text-[#EF4444]/70 cursor-pointer text-sm"
        >
          ✕
        </button>
      )}
      {error || 'Transaction failed. Try again.'}
    </div>
  );
}
