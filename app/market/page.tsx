'use client';

import dynamic from 'next/dynamic';

const MarketApp = dynamic(
  () => import('@/components/market/MarketApp').then((m) => m.MarketApp),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-screen flex items-center justify-center text-[var(--qf-text-3)] text-sm"
        style={{
          background:
            'linear-gradient(180deg, var(--qf-bg-1), var(--qf-bg-2) 60%, var(--qf-bg-1))',
        }}
      >
        Loading Stellar4 Marketplace…
      </div>
    ),
  }
);

export default function MarketPage() {
  return <MarketApp />;
}
