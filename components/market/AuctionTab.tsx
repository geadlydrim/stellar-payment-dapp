'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ItemRegistry } from '@/lib/registry';
import type { AuctionListing, AuctionPort } from '@/lib/ports';
import { toUserMessage } from '@/lib/user-error';
import { TokenSelect, ListingMeta } from './TokenSelect';
import { formatEnd, itemForToken, listableForOwner, availableToList, listingSelectEmptyLabel } from './market-utils';

interface AuctionTabProps {
  registry: ItemRegistry;
  port: AuctionPort;
  ownerId: string;
  actorId: string;
  onToast: (msg: string) => void;
  refreshKey: number;
  onMutate: () => void;
  listedTokenIds: ReadonlySet<string>;
}

export function AuctionTab({
  registry,
  port,
  ownerId,
  actorId,
  onToast,
  refreshKey,
  onMutate,
  listedTokenIds,
}: AuctionTabProps) {
  const [auctions, setAuctions] = useState<AuctionListing[]>([]);
  const [tokenId, setTokenId] = useState('');
  const [startPrice, setStartPrice] = useState('5');
  const [durationSec, setDurationSec] = useState('300');
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const ownedListable = listableForOwner(registry, ownerId);
  const listable = availableToList(ownedListable, listedTokenIds);

  const reload = useCallback(async () => {
    const withAll = port as AuctionPort & {
      listAll?: () => Promise<AuctionListing[]>;
    };
    if (typeof withAll.listAll === 'function') {
      setAuctions(await withAll.listAll());
    } else {
      setAuctions((await port.listActive?.()) ?? []);
    }
  }, [port]);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 5000);
    return () => clearInterval(t);
  }, [reload, refreshKey]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (tokenId && listedTokenIds.has(tokenId)) setTokenId('');
  }, [tokenId, listedTokenIds]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      onToast(ok);
      onMutate();
      await reload();
    } catch (e) {
      onToast(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section
        className="rounded-xl border border-[var(--qf-card-border)] p-4"
        style={{ background: 'var(--qf-card-bg-soft)' }}
      >
        <h3
          className="text-sm font-semibold text-[var(--qf-text-1)] mb-3"
          style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
        >
          List NFT auction
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <TokenSelect
            items={listable}
            value={tokenId}
            onChange={setTokenId}
            emptyLabel={listingSelectEmptyLabel({
              ownedListable: ownedListable.length,
              available: listable.length,
            })}
          />
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={startPrice}
            onChange={(e) => setStartPrice(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none"
            placeholder="Start price XLM"
            aria-label="Start price XLM"
          />
          <input
            type="number"
            min="30"
            value={durationSec}
            onChange={(e) => setDurationSec(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none"
            placeholder="Duration (sec)"
            aria-label="Duration seconds"
          />
          <button
            type="button"
            disabled={busy || !tokenId || !actorId}
            onClick={() =>
              run(async () => {
                await port.listNftAuction({
                  tokenId,
                  seller: actorId,
                  startPriceXlm: startPrice,
                  durationSec: Number(durationSec) || 300,
                });
                setTokenId('');
              }, 'Auction created')
            }
            className="rounded-lg px-4 py-2 text-sm font-semibold border-none cursor-pointer disabled:opacity-45"
            style={{
              background:
                'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
              color: 'var(--qf-accent-ink)',
            }}
          >
            Start auction
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3
          className="text-sm font-semibold text-[var(--qf-text-1)]"
          style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
        >
          Auctions ({auctions.length})
        </h3>
        {auctions.length === 0 && (
          <p className="text-xs text-[var(--qf-text-4)]">No NFT auctions yet.</p>
        )}
        {auctions.map((auction) => {
          const item = itemForToken(registry, auction.tokenId, auction.seller);
          const mine = auction.seller === actorId;
          const ended = nowMs >= auction.endTime;
          const key = String(auction.auctionId);
          const bidVal =
            bidAmounts[key] ??
            String(
              auction.highestBidXlm
                ? Number(auction.highestBidXlm) + 1
                : auction.startPriceXlm
            );

          return (
            <article
              key={key}
              className="rounded-xl border border-[var(--qf-card-border)] p-4 space-y-3"
              style={{ background: 'var(--qf-card-bg)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <ListingMeta
                  name={item?.meta.name}
                  tokenId={auction.tokenId}
                  seller={auction.seller}
                  youAreSeller={mine}
                />
                <div className="text-right text-xs text-[var(--qf-text-3)] space-y-1">
                  <p>
                    Start {auction.startPriceXlm} XLM ·{' '}
                    <span className="text-[var(--qf-text-1)] font-medium">
                      {formatEnd(auction.endTime)}
                    </span>
                  </p>
                  <p>
                    High:{' '}
                    {auction.highestBidXlm
                      ? `${auction.highestBidXlm} XLM`
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {!mine && !ended && port.placeBid && (
                  <>
                    <input
                      type="number"
                      value={bidVal}
                      onChange={(e) =>
                        setBidAmounts((m) => ({ ...m, [key]: e.target.value }))
                      }
                      className="w-24 rounded-lg px-2 py-1.5 text-xs border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none"
                      aria-label="Bid amount"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            port.placeBid!({
                              auctionId: auction.auctionId,
                              bidder: actorId,
                              amountXlm: bidVal,
                            }),
                          'Bid placed'
                        )
                      }
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold border-none cursor-pointer"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
                        color: 'var(--qf-accent-ink)',
                      }}
                    >
                      Bid
                    </button>
                  </>
                )}
                {port.close && mine && !ended && (
                  <span className="text-[11px] text-[var(--qf-text-4)]">
                    Settle after the timer ends
                  </span>
                )}
                {port.close && ended && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          port.close!({
                            auctionId: auction.auctionId,
                            caller: actorId,
                          }),
                        auction.highestBidder
                          ? 'Closed — NFT sent to the highest bidder'
                          : 'Closed — no bids, NFT returned'
                      )
                    }
                    className="rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer border border-[var(--qf-card-border)] bg-transparent text-[var(--qf-text-2)]"
                  >
                    Close & settle
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
