'use client';

import type { Auction } from '@/lib/auction';
import { AuctionCard } from './AuctionCard';

interface AuctionListProps {
  auctions: Auction[];
  loading: boolean;
  error: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function AuctionList({
  auctions,
  loading,
  error,
  selectedId,
  onSelect,
}: AuctionListProps) {
  if (loading && auctions.length === 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[140px] rounded-2xl bg-[var(--qf-input-bg)] border border-[var(--qf-card-border)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error && auctions.length === 0) {
    return (
      <p className="text-[13.5px] text-[#EF4444] py-4">{error}</p>
    );
  }

  if (auctions.length === 0) {
    return (
      <p className="text-[14px] text-[var(--qf-text-3)] py-6 text-center">
        No auctions yet — create the first one.
      </p>
    );
  }

  const sorted = [...auctions].sort((a, b) => b.id - a.id);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map((a) => (
        <AuctionCard
          key={a.id}
          auction={a}
          selected={selectedId === a.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
