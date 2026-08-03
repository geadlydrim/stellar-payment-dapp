'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MemoryItemRegistry,
  isListable,
  type Item,
} from '@/lib/registry';
import {
  PLAYER_OWNER_ID,
  getGameRegistry,
} from '@/lib/game';
import { getMockMarketPorts, type MockMarketPorts } from '@/lib/adapters/mock';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SaleTab } from './SaleTab';
import { AuctionTab } from './AuctionTab';
import { TradeTab } from './TradeTab';
import { shortId } from './market-utils';

export const DEMO_BUYER_ID = 'stellar4-demo-buyer';

type TabId = 'sale' | 'auction' | 'trade';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sale', label: 'Sale' },
  { id: 'auction', label: 'Auction' },
  { id: 'trade', label: 'Trade' },
];

export function MarketApp() {
  const [tab, setTab] = useState<TabId>('sale');
  const [ports, setPorts] = useState<MockMarketPorts | null>(null);
  const [nfts, setNfts] = useState<Item[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const registry = useMemo(() => getGameRegistry(), []);

  const reloadNfts = useCallback(() => {
    if (registry instanceof MemoryItemRegistry) {
      setNfts(
        registry
          .listAll()
          .filter((i) => i.ownerId === PLAYER_OWNER_ID && isListable(i))
      );
    } else {
      setNfts(
        registry.listByOwner(PLAYER_OWNER_ID).filter(isListable)
      );
    }
  }, [registry]);

  useEffect(() => {
    setPorts(getMockMarketPorts(registry));
    reloadNfts();
    setHydrated(true);
  }, [registry, reloadNfts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const onMutate = () => {
    reloadNfts();
    setRefreshKey((k) => k + 1);
  };

  const onToast = (msg: string) => setToast(msg);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, var(--qf-bg-1), var(--qf-bg-2) 55%, var(--qf-bg-1))',
      }}
    >
      <header
        className="sticky top-0 z-40 border-b border-[var(--qf-card-border)] backdrop-blur-md"
        style={{ background: 'var(--qf-header-bg)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              className="text-xs text-[var(--qf-text-4)] hover:text-[var(--qf-text-2)] no-underline"
            >
              ← Home
            </a>
            <h1
              className="text-lg sm:text-xl font-bold text-[var(--qf-text-1)] truncate"
              style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
            >
              Stellar4 Marketplace
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/play"
              className="text-xs font-medium text-[var(--qf-text-2)] no-underline hover:text-[var(--qf-text-1)]"
            >
              Play
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <p className="text-sm text-[var(--qf-text-3)]">
          Sale, auction, and offer-board trade for exported NFTs. Mock ports flip
          Registry state — Stellar adapters plug in later without rewriting Game.
        </p>

        {hydrated && (
          <div
            className="rounded-xl border border-[var(--qf-card-border)] px-4 py-3 text-xs text-[var(--qf-text-3)]"
            style={{ background: 'var(--qf-card-bg-soft)' }}
          >
            Your listable NFTs:{' '}
            {nfts.length === 0 ? (
              <span>
                none — export from{' '}
                <a href="/play" className="underline text-[var(--qf-text-2)]">
                  /play
                </a>
              </span>
            ) : (
              <span className="text-[var(--qf-text-2)]">
                {nfts
                  .map((i) => `${i.meta.name} (${shortId(i.tokenId!)})`)
                  .join(' · ')}
              </span>
            )}
          </div>
        )}

        <div
          role="tablist"
          aria-label="Marketplace modes"
          className="flex gap-1 p-1 rounded-xl border border-[var(--qf-card-border)]"
          style={{ background: 'var(--qf-card-bg-soft)' }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className="flex-1 rounded-lg py-2 text-sm font-semibold border-none cursor-pointer transition-colors"
                style={{
                  background: active
                    ? 'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))'
                    : 'transparent',
                  color: active ? 'var(--qf-accent-ink)' : 'var(--qf-text-3)',
                  fontFamily: 'var(--font-poppins), sans-serif',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {!ports ? (
          <p className="text-sm text-[var(--qf-text-4)]">Loading market…</p>
        ) : (
          <div role="tabpanel">
            {tab === 'sale' && (
              <SaleTab
                registry={registry}
                port={ports.fixedPrice}
                ownerId={PLAYER_OWNER_ID}
                demoBuyerId={DEMO_BUYER_ID}
                onToast={onToast}
                refreshKey={refreshKey}
                onMutate={onMutate}
              />
            )}
            {tab === 'auction' && (
              <AuctionTab
                registry={registry}
                port={ports.auction}
                ownerId={PLAYER_OWNER_ID}
                demoBuyerId={DEMO_BUYER_ID}
                onToast={onToast}
                refreshKey={refreshKey}
                onMutate={onMutate}
              />
            )}
            {tab === 'trade' && (
              <TradeTab
                registry={registry}
                port={ports.offerBoard}
                ownerId={PLAYER_OWNER_ID}
                demoBuyerId={DEMO_BUYER_ID}
                onToast={onToast}
                refreshKey={refreshKey}
                onMutate={onMutate}
              />
            )}
          </div>
        )}
      </main>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-[qf-toast-in_0.25s_ease]"
          style={{
            background: 'var(--qf-toast-bg)',
            border: '1px solid var(--qf-toast-border)',
            color: 'var(--qf-text-1)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
