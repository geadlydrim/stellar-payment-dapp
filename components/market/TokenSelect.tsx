'use client';

import type { Item } from '@/lib/registry';
import { shortId } from './market-utils';

interface TokenSelectProps {
  items: Item[];
  value: string;
  onChange: (tokenId: string) => void;
  emptyLabel?: string;
}

export function TokenSelect({
  items,
  value,
  onChange,
  emptyLabel = 'Export one from Play first',
}: TokenSelectProps) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-[var(--qf-text-4)]">{emptyLabel}</p>
    );
  }

  return (
    <select
      value={items.find((i) => i.tokenId === value)?.id ?? ''}
      onChange={(e) => {
        const item = items.find((i) => i.id === e.target.value);
        onChange(item?.tokenId ?? '');
      }}
      className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none"
    >
      <option value="">Select NFT…</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.meta.name} ({shortId(item.tokenId!)})
        </option>
      ))}
    </select>
  );
}

interface ListingMetaProps {
  name?: string;
  tokenId: string;
  seller: string;
  youAreSeller: boolean;
}

export function ListingMeta({
  name,
  tokenId,
  seller,
  youAreSeller,
}: ListingMetaProps) {
  return (
    <div className="min-w-0">
      <p
        className="font-semibold text-[var(--qf-text-1)] truncate"
        style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
      >
        {name ?? 'NFT'}
      </p>
      <p className="text-[11px] font-mono text-[var(--qf-text-4)] truncate">
        {shortId(tokenId, 10, 6)}
      </p>
      <p className="text-[11px] text-[var(--qf-text-3)] mt-0.5">
        Seller: {youAreSeller ? 'you' : shortId(seller, 8, 4)}
      </p>
    </div>
  );
}
