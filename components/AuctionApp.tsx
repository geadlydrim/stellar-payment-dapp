'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { stellar } from '@/lib/stellar-helper';
import {
  connect as walletConnect,
  disconnect as walletDisconnect,
} from '@/lib/wallet';
import { listAuctions, friendlyAuctionError, type Auction } from '@/lib/auction';
import { getContractEvents } from '@/lib/soroban';
import { Section } from './Section';
import { ThemeToggle } from './ThemeToggle';
import { Toast } from './ui/Toast';
import { Confetti, makeConfettiBurst } from './ui/Confetti';
import { AuctionList } from './auction/AuctionList';
import { CreateAuctionForm } from './auction/CreateAuctionForm';
import { AuctionDetail } from './auction/AuctionDetail';
import { BidFeed, type FeedItem } from './auction/BidFeed';

function shortAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function friendlyConnectError(err: unknown): string {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? '');
  const lower = raw.toLowerCase();
  if (raw.includes('no elements in sequence')) {
    return 'No wallet selected — pick one from the list, or unlock your wallet extension.';
  }
  if (lower.includes('not installed') || lower.includes('not found')) {
    return 'No Stellar wallet found. Install Freighter or another supported wallet.';
  }
  if (lower.includes('rejected') || lower.includes('declined')) {
    return 'Connection request was declined.';
  }
  return friendlyAuctionError(err);
}

function relativeTimeLabel(): string {
  return 'Just now';
}

export default function AuctionApp() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [connectError, setConnectError] = useState('');
  const [balance, setBalance] = useState(0);

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<ReturnType<typeof makeConfettiBurst>>([]);

  const lastLedgerRef = useRef(0);
  const pollReadyRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3400);
  }, []);

  const burstConfetti = useCallback(() => {
    const cs = getComputedStyle(document.documentElement);
    const colors = ['--qf-accent-1', '--qf-accent-2', '--qf-secondary'].map((v) =>
      cs.getPropertyValue(v).trim()
    );
    setConfetti(makeConfettiBurst(colors));
    setTimeout(() => setConfetti([]), 1700);
  }, []);

  const loadBalance = useCallback(async (key: string) => {
    try {
      const data = await stellar.getBalance(key);
      setBalance(parseFloat(data.xlm) || 0);
    } catch {
      /* keep previous */
    }
  }, []);

  const loadAuctions = useCallback(async () => {
    setListError('');
    try {
      const list = await listAuctions();
      setAuctions(list);
      setSelectedId((prev) => {
        if (prev != null && list.some((a) => a.id === prev)) return prev;
        return list.length > 0 ? list[list.length - 1].id : null;
      });
    } catch (err) {
      setListError(friendlyAuctionError(err));
    } finally {
      setListLoading(false);
    }
  }, []);

  const pushFeed = useCallback((kind: FeedItem['kind'], auctionId: number, message: string) => {
    const item: FeedItem = {
      id: `${kind}-${auctionId}-${Date.now()}`,
      kind,
      auctionId,
      message,
      time: relativeTimeLabel(),
    };
    setFeed((prev) => [item, ...prev].slice(0, 40));
  }, []);

  // Initial load + refresh when contract id is configured
  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  // Real-time: poll contract events every 5s
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const { events, latestLedger } = await getContractEvents(lastLedgerRef.current);
        if (cancelled) return;

        if (lastLedgerRef.current === 0) {
          // First poll: seed ledger cursor without flooding the feed
          lastLedgerRef.current = latestLedger;
          pollReadyRef.current = true;
          return;
        }

        lastLedgerRef.current = Math.max(lastLedgerRef.current, latestLedger);

        if (!pollReadyRef.current || events.length === 0) return;

        let shouldRefresh = false;
        for (const ev of events) {
          const topics = ev.topics.map((t) => t.toLowerCase());
          const isAuction = topics.some((t) => t.includes('auction'));
          if (!isAuction && topics.length < 2) continue;

          const action = topics.find((t) =>
            ['created', 'bid', 'closed'].includes(t)
          );
          const idTopic = topics.find((t) => /^\d+$/.test(t));
          const auctionId = idTopic != null ? Number(idTopic) : -1;

          if (action === 'created') {
            pushFeed('created', auctionId, `Auction #${auctionId} created`);
            showToast(`New auction #${auctionId}`);
            shouldRefresh = true;
          } else if (action === 'bid') {
            pushFeed('bid', auctionId, `New bid on auction #${auctionId}`);
            showToast(`New bid on #${auctionId}`);
            shouldRefresh = true;
          } else if (action === 'closed') {
            pushFeed('closed', auctionId, `Auction #${auctionId} closed`);
            showToast(`Auction #${auctionId} closed`);
            shouldRefresh = true;
          } else if (events.length > 0) {
            shouldRefresh = true;
          }

          if (ev.ledger > lastLedgerRef.current) {
            lastLedgerRef.current = ev.ledger;
          }
        }

        if (shouldRefresh) {
          await loadAuctions();
          if (publicKey) loadBalance(publicKey);
        }
      } catch {
        // Contract not configured yet or RPC blip — ignore
      }
    };

    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadAuctions, loadBalance, publicKey, pushFeed, showToast]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const key = await walletConnect();
      setPublicKey(key);
      setConnected(true);
      showToast('Wallet connected');
      loadBalance(key);
    } catch (err) {
      setConnectError(friendlyConnectError(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    walletDisconnect();
    setConnected(false);
    setPublicKey('');
    setBalance(0);
  };

  const selected = auctions.find((a) => a.id === selectedId) ?? null;

  const onTxSuccess = (msg: string) => {
    showToast(msg);
    burstConfetti();
    loadAuctions();
    if (publicKey) loadBalance(publicKey);
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, var(--qf-bg-1), var(--qf-bg-2) 60%, var(--qf-bg-1))',
      }}
    >
      <header className="sticky top-0 z-20 bg-[var(--qf-header-bg)] backdrop-blur-2xl border-b border-[var(--qf-card-border)]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--qf-accent-1)] to-[var(--qf-accent-2)] flex items-center justify-center flex-shrink-0">
              <span className="text-[15px] text-[var(--qf-accent-ink)] opacity-85">◈</span>
            </div>
            <div className="min-w-0">
              <p className="font-poppins font-semibold text-[17px] text-[var(--qf-text-1)] truncate">
                BidDrift
              </p>
              <p className="hidden sm:block text-[11.5px] text-[var(--qf-text-3)]">
                Real-time auctions on Stellar
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            {connected ? (
              <>
                <span className="hidden sm:inline text-[12px] text-[var(--qf-text-3)]">
                  {balance.toFixed(2)} XLM
                </span>
                <span className="font-mono text-xs text-[var(--qf-text-3)] bg-[var(--qf-input-bg)] border border-[var(--qf-card-border)] py-[7px] px-3 rounded-full whitespace-nowrap">
                  {shortAddress(publicKey)}
                </span>
                <button
                  onClick={handleDisconnect}
                  className="text-[12.5px] text-[var(--qf-text-2)] border border-[var(--qf-card-border)] bg-transparent rounded-full py-[7px] px-3 cursor-pointer hover:bg-[var(--qf-input-bg)]"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="text-[12.5px] font-poppins font-semibold text-[var(--qf-accent-ink)] rounded-full py-[8px] px-4 border-none cursor-pointer disabled:opacity-60"
                style={{
                  background:
                    'linear-gradient(135deg,var(--qf-accent-1),var(--qf-accent-2))',
                }}
              >
                {connecting ? 'Connecting…' : 'Connect wallet'}
              </button>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {!connected && (
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 pt-12 pb-2 text-center">
          <h1 className="mb-3.5 font-poppins font-bold text-[clamp(28px,4vw,40px)] leading-[1.15] text-[var(--qf-text-1)]">
            BidDrift
          </h1>
          <p className="mx-auto max-w-[480px] text-base leading-relaxed text-[var(--qf-text-2)]">
            Live multi-auction marketplace on Stellar testnet — create listings, escrow
            XLM bids, and watch the board update in real time.
          </p>
          {connectError && (
            <p className="mt-3 text-[13px] text-[#EF4444]">{connectError}</p>
          )}
        </div>
      )}

      <main className="max-w-[960px] mx-auto px-4 sm:px-6 pt-10 pb-12">
        <div className="flex flex-col gap-[18px]">
          <Section
            action={
              <button
                onClick={() => {
                  setListLoading(true);
                  loadAuctions();
                }}
                className="border-none bg-transparent cursor-pointer text-[var(--qf-text-3)] text-[12.5px] flex items-center gap-1.5"
              >
                <span className={listLoading ? 'animate-spin inline-block' : 'inline-block'}>
                  ↻
                </span>{' '}
                refresh
              </button>
            }
          >
            <h2 className="mt-1 mb-[18px] font-poppins font-semibold text-[21px] text-[var(--qf-text-1)]">
              Auctions
            </h2>
            <AuctionList
              auctions={auctions}
              loading={listLoading}
              error={listError}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Section>

          <div className="grid gap-[18px] lg:grid-cols-2">
            <Section>
              <AuctionDetail
                auction={selected}
                publicKey={connected ? publicKey : null}
                balanceXlm={balance}
                explorerLink={(hash) => stellar.getExplorerLink(hash, 'tx')}
                onUpdated={() => {
                  loadAuctions();
                  if (publicKey) loadBalance(publicKey);
                }}
                onSuccessToast={onTxSuccess}
              />
            </Section>

            <Section>
              <CreateAuctionForm
                publicKey={connected ? publicKey : null}
                explorerLink={(hash) => stellar.getExplorerLink(hash, 'tx')}
                onCreated={() => onTxSuccess('Auction created')}
              />
            </Section>
          </div>

          <Section>
            <h2 className="mt-1 mb-[14px] font-poppins font-semibold text-[21px] text-[var(--qf-text-1)]">
              Live activity
            </h2>
            <BidFeed items={feed} />
          </Section>
        </div>
      </main>

      <footer className="border-t border-[var(--qf-card-border)] py-5 text-center text-[12px] text-[var(--qf-text-4)]">
        BidDrift · Stellar testnet · No real funds
      </footer>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <Confetti particles={confetti} />
    </div>
  );
}
