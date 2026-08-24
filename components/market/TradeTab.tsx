'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ItemRegistry } from '@/lib/registry';
import type { OfferBoardPort, TradeListing, TradeOffer } from '@/lib/ports';
import { PortError } from '@/lib/adapters';
import { TokenSelect, ListingMeta } from './TokenSelect';
import { itemForToken, listableForOwner, shortId } from './market-utils';

interface TradeTabProps {
  registry: ItemRegistry;
  port: OfferBoardPort;
  ownerId: string;
  actorId: string;
  demoBuyerId: string;
  onToast: (msg: string) => void;
  refreshKey: number;
  onMutate: () => void;
}

export function TradeTab({
  registry,
  port,
  ownerId,
  actorId,
  demoBuyerId,
  onToast,
  refreshKey,
  onMutate,
}: TradeTabProps) {
  const [listings, setListings] = useState<TradeListing[]>([]);
  const [offersByListing, setOffersByListing] = useState<
    Record<string, TradeOffer[]>
  >({});
  const [tokenId, setTokenId] = useState('');
  const [wantsHint, setWantsHint] = useState('');
  const [offerXlm, setOfferXlm] = useState<Record<string, string>>({});
  const [offerTokens, setOfferTokens] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const listable = listableForOwner(registry, ownerId);

  const reload = useCallback(async () => {
    const active = (await port.listActive?.()) ?? [];
    setListings(active);
    const map: Record<string, TradeOffer[]> = {};
    for (const listing of active) {
      const key = String(listing.listingId);
      map[key] = (await port.listOffers?.(listing.listingId)) ?? [];
    }
    setOffersByListing(map);
  }, [port]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      onToast(ok);
      onMutate();
      await reload();
    } catch (e) {
      onToast(e instanceof PortError || e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-[var(--qf-text-3)]">
        Offer board — buyers propose XLM and/or NFT tokenIds; seller{' '}
        <strong className="font-medium text-[var(--qf-text-2)]">accepts or rejects</strong>.
        Not an automatic swap.
      </p>

      <section
        className="rounded-xl border border-[var(--qf-card-border)] p-4"
        style={{ background: 'var(--qf-card-bg-soft)' }}
      >
        <h3
          className="text-sm font-semibold text-[var(--qf-text-1)] mb-3"
          style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
        >
          Open to offers
        </h3>
        <div className="grid gap-2">
          <TokenSelect items={listable} value={tokenId} onChange={setTokenId} />
          <input
            value={wantsHint}
            onChange={(e) => setWantsHint(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none"
            placeholder="Wants hint (e.g. legendary sword or 50 XLM)"
          />
          <button
            type="button"
            disabled={busy || !tokenId || !actorId}
            onClick={() =>
              run(async () => {
                await port.listForOffers({
                  tokenId,
                  seller: actorId,
                  wantsHint: wantsHint.trim() || undefined,
                });
                setTokenId('');
                setWantsHint('');
              }, 'Opened to offers')
            }
            className="rounded-lg px-4 py-2 text-sm font-semibold border-none cursor-pointer disabled:opacity-45 justify-self-start"
            style={{
              background:
                'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
              color: 'var(--qf-accent-ink)',
            }}
          >
            List for trade
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3
          className="text-sm font-semibold text-[var(--qf-text-1)]"
          style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
        >
          Trade listings ({listings.length})
        </h3>
        {listings.length === 0 && (
          <p className="text-xs text-[var(--qf-text-4)]">No open trade listings.</p>
        )}
        {listings.map((listing) => {
          const item = itemForToken(registry, listing.tokenId);
          const mine = listing.seller === actorId;
          const key = String(listing.listingId);
          const offers = offersByListing[key] ?? [];
          const pending = offers.filter((o) => o.status === 'pending');
          const xlm = offerXlm[key] ?? '0';
          const offerTok = offerTokens[key] ?? '';

          return (
            <article
              key={key}
              className="rounded-xl border border-[var(--qf-card-border)] p-4 space-y-3"
              style={{ background: 'var(--qf-card-bg)' }}
            >
              <div className="flex flex-col sm:flex-row justify-between gap-2">
                <ListingMeta
                  name={item?.meta.name}
                  tokenId={listing.tokenId}
                  seller={listing.seller}
                  youAreSeller={mine}
                />
                {listing.wantsHint && (
                  <p className="text-xs text-[var(--qf-text-3)] max-w-xs sm:text-right">
                    Wants: {listing.wantsHint}
                  </p>
                )}
              </div>

              {mine && port.cancelListing && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        port.cancelListing!({
                          listingId: listing.listingId,
                          seller: actorId,
                        }),
                      'Trade listing cancelled'
                    )
                  }
                  className="rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer border border-[var(--qf-card-border)] bg-transparent text-[var(--qf-text-2)]"
                >
                  Cancel listing
                </button>
              )}

              {!mine && (
                <div className="grid gap-2 sm:grid-cols-[100px_1fr_auto] items-end">
                  <label className="text-[11px] text-[var(--qf-text-4)]">
                    XLM
                    <input
                      type="number"
                      min="0"
                      value={xlm}
                      onChange={(e) =>
                        setOfferXlm((m) => ({ ...m, [key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none"
                    />
                  </label>
                  <label className="text-[11px] text-[var(--qf-text-4)]">
                    Offer NFT (optional)
                    <div className="mt-1">
                      <TokenSelect
                        items={listable}
                        value={offerTok}
                        onChange={(v) =>
                          setOfferTokens((m) => ({ ...m, [key]: v }))
                        }
                        emptyLabel="No spare NFTs to offer"
                      />
                    </div>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          port.submitOffer({
                            listingId: listing.listingId,
                            buyer: actorId,
                            xlm,
                            offerTokenIds: offerTok ? [offerTok] : [],
                          }),
                        'Offer submitted'
                      )
                    }
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold border-none cursor-pointer"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
                      color: 'var(--qf-accent-ink)',
                    }}
                  >
                    Submit offer
                  </button>
                </div>
              )}

              {mine && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        port.submitOffer({
                          listingId: listing.listingId,
                          buyer: demoBuyerId,
                          xlm: '15',
                          offerTokenIds: [],
                        }),
                      'Demo offer submitted (15 XLM)'
                    )
                  }
                  className="rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer border border-dashed border-[var(--qf-card-border)] bg-transparent text-[var(--qf-text-3)]"
                >
                  Simulate buyer offer
                </button>
              )}

              {pending.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--qf-card-border-soft)]">
                  <p className="text-[11px] font-medium text-[var(--qf-text-3)]">
                    Pending offers
                  </p>
                  {pending.map((offer) => (
                    <div
                      key={String(offer.offerId)}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs rounded-lg px-3 py-2"
                      style={{ background: 'var(--qf-input-bg)' }}
                    >
                      <span className="text-[var(--qf-text-2)]">
                        {offer.buyer === demoBuyerId ? 'demo buyer' : shortId(offer.buyer)}:{' '}
                        {offer.xlm} XLM
                        {offer.offerTokenIds.length > 0 &&
                          ` + ${offer.offerTokenIds.map((t) => shortId(t)).join(', ')}`}
                      </span>
                      {mine && (
                        <span className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  port.acceptOffer({
                                    offerId: offer.offerId,
                                    seller: actorId,
                                  }),
                                'Offer accepted — assets transferred'
                              )
                            }
                            className="rounded-md px-2 py-1 font-semibold border-none cursor-pointer"
                            style={{
                              background: 'var(--qf-accent-1)',
                              color: 'var(--qf-accent-ink)',
                            }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  port.rejectOffer({
                                    offerId: offer.offerId,
                                    seller: actorId,
                                  }),
                                'Offer rejected'
                              )
                            }
                            className="rounded-md px-2 py-1 cursor-pointer border border-[var(--qf-card-border)] bg-transparent text-[var(--qf-text-2)]"
                          >
                            Reject
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
