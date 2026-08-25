'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ItemRegistry } from '@/lib/registry';
import type { FixedPriceListing, FixedPricePort } from '@/lib/ports';
import { toUserMessage } from '@/lib/user-error';
import { TokenSelect, ListingMeta } from './TokenSelect';
import {
  availableToList,
  itemForToken,
  listableForOwner,
  listingSelectEmptyLabel,
} from './market-utils';

interface SaleTabProps {
  registry: ItemRegistry;
  port: FixedPricePort;
  /** Registry owner for listable inventory (same session id as actorId). */
  ownerId: string;
  /** Signer / counterparty for port calls (guest on mock, wallet on stellar). */
  actorId: string;
  onToast: (msg: string) => void;
  refreshKey: number;
  onMutate: () => void;
  /** TokenIds already occupying a sale / auction / trade listing. */
  listedTokenIds: ReadonlySet<string>;
}

export function SaleTab({
  registry,
  port,
  ownerId,
  actorId,
  onToast,
  refreshKey,
  onMutate,
  listedTokenIds,
}: SaleTabProps) {
  const [listings, setListings] = useState<FixedPriceListing[]>([]);
  const [tokenId, setTokenId] = useState('');
  const [price, setPrice] = useState('10');
  const [busy, setBusy] = useState(false);

  const ownedListable = listableForOwner(registry, ownerId);
  const listable = availableToList(ownedListable, listedTokenIds);

  const reload = useCallback(async () => {
    const active = (await port.listActive?.()) ?? [];
    setListings(active);
  }, [port]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

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
          className="text-sm font-semibold text-[var(--qf-text-1)] mb-1"
          style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
        >
          List for fixed price
        </h3>
        <p className="text-xs text-[var(--qf-text-3)] mb-3">
          Only items you've exported from Play can be listed.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
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
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none"
            placeholder="XLM"
            aria-label="Price in XLM"
          />
          <button
            type="button"
            disabled={busy || !tokenId || !actorId}
            onClick={() =>
              run(async () => {
                await port.list({ tokenId, seller: actorId, priceXlm: price });
                setTokenId('');
              }, 'Listed for sale')
            }
            className="rounded-lg px-4 py-2 text-sm font-semibold border-none cursor-pointer disabled:opacity-45"
            style={{
              background:
                'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
              color: 'var(--qf-accent-ink)',
            }}
          >
            List
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3
          className="text-sm font-semibold text-[var(--qf-text-1)]"
          style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
        >
          Active sales ({listings.length})
        </h3>
        {listings.length === 0 && (
          <p className="text-xs text-[var(--qf-text-4)]">No active fixed-price listings.</p>
        )}
        {listings.map((listing) => {
          const item = itemForToken(registry, listing.tokenId, listing.seller);
          const mine = listing.seller === actorId;
          return (
            <article
              key={String(listing.listingId)}
              className="rounded-xl border border-[var(--qf-card-border)] p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              style={{ background: 'var(--qf-card-bg)' }}
            >
              <ListingMeta
                name={item?.meta.name}
                tokenId={listing.tokenId}
                seller={listing.seller}
                youAreSeller={mine}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[var(--qf-text-1)]">
                  {listing.priceXlm} XLM
                </span>
                {mine ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          port.cancel({
                            listingId: listing.listingId,
                            seller: actorId,
                          }),
                        'Sale cancelled'
                      )
                    }
                    className="rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer border border-[var(--qf-card-border)] bg-transparent text-[var(--qf-text-2)]"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          port.buy({
                            listingId: listing.listingId,
                            buyer: actorId,
                          }),
                        'Purchased'
                      )
                    }
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold border-none cursor-pointer"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
                      color: 'var(--qf-accent-ink)',
                    }}
                  >
                    Buy
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
