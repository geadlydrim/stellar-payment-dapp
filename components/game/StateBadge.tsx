'use client';

import { TIER_COLORS } from '@/lib/game';
import type { ItemState } from '@/lib/registry';

const STYLES: Record<ItemState, { label: string; bg: string; fg: string }> = {
  InGame: {
    label: 'In Game',
    bg: 'rgba(34, 197, 94, 0.18)',
    fg: '#16a34a',
  },
  LockedForTrade: {
    label: 'Locked',
    bg: 'rgba(245, 158, 11, 0.2)',
    fg: '#d97706',
  },
  AsNft: {
    label: 'As NFT',
    bg: 'rgba(59, 130, 246, 0.18)',
    fg: '#2563eb',
  },
};

export function StateBadge({ state }: { state: ItemState }) {
  const s = STYLES[state];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export function TierDot({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier as keyof typeof TIER_COLORS] ?? '#9ca3af';
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      title={tier}
    />
  );
}
