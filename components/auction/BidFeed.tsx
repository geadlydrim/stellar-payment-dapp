'use client';

export interface FeedItem {
  id: string;
  kind: 'created' | 'bid' | 'closed';
  auctionId: number;
  message: string;
  time: string;
}

interface BidFeedProps {
  items: FeedItem[];
}

const KIND_COLOR: Record<FeedItem['kind'], string> = {
  created: 'text-[var(--qf-accent-1)]',
  bid: 'text-[#16A34A]',
  closed: 'text-[#D97706]',
};

export function BidFeed({ items }: BidFeedProps) {
  if (items.length === 0) {
    return (
      <p className="text-[13px] text-[var(--qf-text-4)] py-2">
        Live activity will appear here as auctions are created, bid on, and closed.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-2.5 text-[12.5px] animate-[qf-fadeup_0.35s_ease-out]"
        >
          <span
            className={`font-poppins font-semibold uppercase tracking-wide text-[10px] mt-0.5 w-14 flex-shrink-0 ${KIND_COLOR[item.kind]}`}
          >
            {item.kind}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[var(--qf-text-2)] leading-snug">{item.message}</p>
            <p className="text-[10.5px] text-[var(--qf-text-4)] mt-0.5">{item.time}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
