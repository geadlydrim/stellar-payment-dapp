'use client';

import { useCountUp } from '@/lib/useCountUp';
import { Sparkline } from '../ui/Sparkline';

interface AssetBalance {
  code: string;
  issuer: string;
  balance: string;
}

export function BalanceStep({
  disabled,
  loading,
  balance,
  assets,
  error,
  balancePoints,
}: {
  disabled: boolean;
  loading: boolean;
  balance: number;
  assets: AssetBalance[];
  error: string;
  balancePoints: number[];
}) {
  const animatedBalance = useCountUp(balance);

  if (disabled) {
    return <p className="mt-2 text-[14.5px] text-[var(--qf-text-4)]">Connect a wallet to see your balance.</p>;
  }

  return (
    <>
      <h2 className="mt-1 mb-4 font-poppins font-semibold text-[21px] text-[var(--qf-text-1)]">Your balance</h2>
      {loading ? (
        <>
          <div className="h-[14px] rounded-lg mb-2.5 qf-shimmer-bg" />
          <div className="h-9 rounded-[10px] qf-shimmer-bg" />
        </>
      ) : error ? (
        <p className="text-[13px] text-[#F87171] leading-relaxed">{error}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2.5 mb-3">
            <span className="font-poppins font-bold text-[38px] text-[var(--qf-text-1)]">
              {animatedBalance.toFixed(2)}
            </span>
            <span className="text-[15px] text-[var(--qf-text-3)]">XLM</span>
          </div>

          {balancePoints.length >= 2 && (
            <div className="mb-2">
              <Sparkline points={balancePoints} />
            </div>
          )}

          {assets.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-[11px] tracking-[0.06em] uppercase text-[var(--qf-text-4)] font-poppins font-semibold">
                Other assets
              </p>
              {assets.map((asset) => (
                <div
                  key={`${asset.code}-${asset.issuer}`}
                  className="flex items-center justify-between gap-3 bg-[var(--qf-card-bg-soft)] border border-[var(--qf-card-border-soft)] rounded-xl py-2.5 px-3.5"
                >
                  <span className="text-[13px] font-medium text-[var(--qf-text-1)]">{asset.code}</span>
                  <span className="font-poppins font-semibold text-[13px] text-[var(--qf-text-2)] tabular-nums">
                    {parseFloat(asset.balance).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
