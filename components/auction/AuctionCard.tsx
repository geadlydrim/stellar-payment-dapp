'use client';

import { useEffect, useState } from 'react';
import {
  type Auction,
  auctionStatus,
  formatXlm,
} from '@/lib/auction';

function useCountdown(endTime: number) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, endTime - now);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const label =
    remaining <= 0
      ? 'Ended'
      : h > 0
        ? `${h}h ${m}m ${s}s`
        : m > 0
          ? `${m}m ${s}s`
          : `${s}s`;

  return { remaining, label, now };
}

function StatusBadge({ auction, now }: { auction: Auction; now: number }) {
  const status = auctionStatus(auction, now);
  const styles =
    status === 'live'
      ? 'bg-[#22C55E]/15 text-[#16A34A] border-[#22C55E]/30'
      : status === 'ended'
        ? 'bg-[#F59E0B]/15 text-[#D97706] border-[#F59E0B]/30'
        : 'bg-[var(--qf-text-3)]/15 text-[var(--qf-text-3)] border-[var(--qf-card-border)]';
  const label = status === 'live' ? 'Live' : status === 'ended' ? 'Ended' : 'Settled';
  return (
    <span
      className={`text-[11px] font-poppins font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full border ${styles}`}
    >
      {label}
    </span>
  );
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

interface AuctionCardProps {
  auction: Auction;
  selected?: boolean;
  onSelect: (id: number) => void;
}

export function AuctionCard({ auction, selected, onSelect }: AuctionCardProps) {
  const { label, now } = useCountdown(auction.endTime);
  const current =
    auction.highestBid > 0 ? formatXlm(auction.highestBid) : formatXlm(auction.startPrice);
  const hasBids = auction.highestBid > 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(auction.id)}
      className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
        selected
          ? 'border-[var(--qf-accent-1)] bg-[var(--qf-accent-1)]/8 shadow-[0_0_0_1px_var(--qf-accent-1)]'
          : 'border-[var(--qf-card-border)] bg-[var(--qf-input-bg)] hover:border-[var(--qf-accent-1)]/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <h3 className="font-poppins font-semibold text-[15px] text-[var(--qf-text-1)] leading-snug line-clamp-2">
          {auction.item}
        </h3>
        <StatusBadge auction={auction} now={now} />
      </div>
      <p className="text-[12.5px] text-[var(--qf-text-3)] mb-3 line-clamp-2">{auction.description}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10.5px] uppercase tracking-wider text-[var(--qf-text-4)] mb-0.5">
            {hasBids ? 'Current bid' : 'Starting at'}
          </p>
          <p className="font-poppins font-semibold text-[18px] text-[var(--qf-text-1)]">
            {current} <span className="text-[12px] font-medium text-[var(--qf-text-3)]">XLM</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] uppercase tracking-wider text-[var(--qf-text-4)] mb-0.5">
            Time left
          </p>
          <p className="font-mono text-[13px] text-[var(--qf-text-2)]">{label}</p>
        </div>
      </div>
      <p className="mt-2.5 text-[11px] text-[var(--qf-text-4)] font-mono">
        Seller {shortAddr(auction.seller)}
      </p>
    </button>
  );
}
