'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Item } from '@/lib/registry';
import { getGameRegistry } from '@/lib/game';
import { getMarketPorts, type MarketPorts } from '@/lib/adapters';
import { useWalletSession } from '@/components/identity/WalletSessionProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SaleTab } from './SaleTab';
import { AuctionTab } from './AuctionTab';
import { TradeTab } from './TradeTab';
import { availableToList, listableForOwner, loadListedTokenIds, shortId } from './market-utils';

export const DEMO_BUYER_ID = 'stellar4-demo-buyer';

type TabId = 'sale' | 'auction' | 'trade';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sale', label: 'Sale' },
  { id: 'auction', label: 'Auction' },
  { id: 'trade', label: 'Trade' },
];

export function MarketApp() {
  const [tab, setTab] = useState<TabId>('sale');
  const [ports, setPorts] = useState<MarketPorts | null>(null);
  const {
    adapter,
    connecting,
    hydrated: walletHydrated,
    session,
    connect: sessionConnect,
    disconnect: sessionDisconnect,
  } = useWalletSession();
  /**
   * Session owner for port seller|buyer|bidder.
   * Mock: guest (`stellar4-player`). Stellar + G…: that wallet. Stellar disconnected: ''.
   */
  const actorId = session?.ownerId ?? '';
  /** Same string as actorId — listable “yours” is never a second person. */
  const inventoryOwnerId = actorId;
  const [nfts, setNfts] = useState<Item[]>([]);
  const [listedTokenIds, setListedTokenIds] = useState<Set<string>>(
    () => new Set()
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const registry = useMemo(() => getGameRegistry(), []);

  const reloadNfts = useCallback(() => {
    if (!inventoryOwnerId) {
      setNfts([]);
      return;
    }
    setNfts(listableForOwner(registry, inventoryOwnerId));
  }, [registry, inventoryOwnerId]);

  const reloadListed = useCallback(async () => {
    if (!ports) {
      setListedTokenIds(new Set());
      return;
    }
    try {
      setListedTokenIds(await loadListedTokenIds(ports));
    } catch {
      setListedTokenIds(new Set());
    }
  }, [ports]);

  useEffect(() => {
    setPorts(getMarketPorts(registry));
  }, [registry]);

  const handleConnect = async () => {
    try {
      await sessionConnect();
      setToast('Wallet connected');
    } catch (e) {
      setToast(
        e instanceof Error ? e.message : 'Wallet connection failed — try Freighter on testnet'
      );
    }
  };

  const handleDisconnect = () => {
    sessionDisconnect();
  };

  const hydrated = walletHydrated && ports !== null;

  useEffect(() => {
    if (!hydrated) return;
    reloadNfts();
    void reloadListed();
  }, [hydrated, reloadNfts, reloadListed, refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const onMutate = () => {
    reloadNfts();
    void reloadListed();
    setRefreshKey((k) => k + 1);
  };

  const onToast = (msg: string) => setToast(msg);

  const availableNfts = availableToList(nfts, listedTokenIds);
  const listedOwnedCount = nfts.filter(
    (i) => i.tokenId && listedTokenIds.has(i.tokenId)
  ).length;

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
            {adapter === 'stellar' &&
              (actorId ? (
                <>
                  <span className="hidden sm:inline font-mono text-[11px] text-[var(--qf-text-3)]">
                    {shortId(actorId, 4, 4)}
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-xs text-[var(--qf-text-2)] border border-[var(--qf-card-border)] bg-transparent rounded-full py-1 px-2.5 cursor-pointer"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="text-xs font-semibold rounded-full py-1.5 px-3 border-none cursor-pointer disabled:opacity-60"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
                    color: 'var(--qf-accent-ink)',
                  }}
                >
                  {connecting ? 'Connecting…' : 'Connect wallet'}
                </button>
              ))}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <p className="text-sm text-[var(--qf-text-3)]">
          Sale, auction, and offer-board trade for exported NFTs.
        </p>

        {hydrated && (
          <div
            className="rounded-xl border border-[var(--qf-card-border)] px-4 py-3 text-xs text-[var(--qf-text-3)]"
            style={{ background: 'var(--qf-card-bg-soft)' }}
          >
            Your NFTs available to list:{' '}
            {availableNfts.length === 0 ? (
              <span>
                {nfts.length === 0 ? (
                  <>
                    none — export from{' '}
                    <a href="/play" className="underline text-[var(--qf-text-2)]">
                      /play
                    </a>
                  </>
                ) : (
                  <>none — {listedOwnedCount} already listed (cancel to list elsewhere)</>
                )}
              </span>
            ) : (
              <span className="text-[var(--qf-text-2)]">
                {availableNfts
                  .map((i) => `${i.meta.name} (${shortId(i.tokenId!)})`)
                  .join(' · ')}
                {listedOwnedCount > 0
                  ? ` · ${listedOwnedCount} already listed`
                  : ''}
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
                ownerId={inventoryOwnerId}
                actorId={actorId}
                demoBuyerId={DEMO_BUYER_ID}
                onToast={onToast}
                refreshKey={refreshKey}
                onMutate={onMutate}
                listedTokenIds={listedTokenIds}
              />
            )}
            {tab === 'auction' && (
              <AuctionTab
                registry={registry}
                port={ports.auction}
                ownerId={inventoryOwnerId}
                actorId={actorId}
                demoBuyerId={DEMO_BUYER_ID}
                onToast={onToast}
                refreshKey={refreshKey}
                onMutate={onMutate}
                listedTokenIds={listedTokenIds}
              />
            )}
            {tab === 'trade' && (
              <TradeTab
                registry={registry}
                port={ports.offerBoard}
                ownerId={inventoryOwnerId}
                actorId={actorId}
                demoBuyerId={DEMO_BUYER_ID}
                onToast={onToast}
                refreshKey={refreshKey}
                onMutate={onMutate}
                listedTokenIds={listedTokenIds}
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
