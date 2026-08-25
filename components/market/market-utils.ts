'use client';

import { isListable, type Item } from '@/lib/registry';
import type { ItemRegistry } from '@/lib/registry';
import { findItemByTokenId } from '@/lib/adapters/helpers';

/** Resolve display metadata for a tokenId from the shared registry. */
export function itemForToken(
  registry: ItemRegistry,
  tokenId: string,
  preferOwnerId?: string
): Item | undefined {
  return findItemByTokenId(registry, tokenId, preferOwnerId);
}

export function listableForOwner(
  registry: ItemRegistry,
  ownerId: string
): Item[] {
  if (!ownerId) return [];
  return registry.listByOwner(ownerId).filter(isListable);
}

/** Union of tokenIds from sale / auction / trade listing rows. */
export function collectListedTokenIds(
  groups: Array<Array<{ tokenId: string }> | undefined | null>
): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    if (!group) continue;
    for (const row of group) {
      if (row.tokenId) ids.add(row.tokenId);
    }
  }
  return ids;
}

/**
 * AsNft items that are not on an active (or unsettled-auction) listing.
 * Port `list` still rejects busy tokens; this keeps them out of TokenSelect.
 */
export function availableToList(
  items: Item[],
  listedTokenIds: ReadonlySet<string>
): Item[] {
  return items.filter((i) => !!i.tokenId && !listedTokenIds.has(i.tokenId));
}

export function listingSelectEmptyLabel(opts: {
  ownedListable: number;
  available: number;
  kind?: 'list' | 'offer';
}): string {
  if (opts.kind === 'offer') {
    if (opts.ownedListable === 0) return 'No spare NFTs to offer';
    if (opts.available === 0) {
      return 'All spare NFTs are listed — cancel one first';
    }
    return 'No spare NFTs to offer';
  }
  if (opts.ownedListable === 0) {
    return 'Export one from Play first';
  }
  if (opts.available === 0) {
    return 'All of your NFTs are already listed — cancel one first';
  }
  return 'Export one from Play first';
}

type TokenIdList = { tokenId: string }[];

/**
 * TokenIds currently occupying a market listing.
 * Auction prefers `listAll` (ended-but-not-closed still occupy the NFT).
 */
export async function loadListedTokenIds(ports: {
  fixedPrice: { listActive?: () => Promise<TokenIdList> };
  auction: {
    listActive?: () => Promise<TokenIdList>;
    listAll?: () => Promise<TokenIdList>;
  };
  offerBoard: { listActive?: () => Promise<TokenIdList> };
}): Promise<Set<string>> {
  const auctionRows =
    typeof ports.auction.listAll === 'function'
      ? ports.auction.listAll()
      : ports.auction.listActive?.() ?? [];
  const [sales, auctions, trades] = await Promise.all([
    ports.fixedPrice.listActive?.() ?? [],
    auctionRows,
    ports.offerBoard.listActive?.() ?? [],
  ]);
  return collectListedTokenIds([sales, auctions, trades]);
}

export function shortId(id: string, head = 6, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function formatEnd(endTime: number): string {
  const ms = endTime - Date.now();
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
