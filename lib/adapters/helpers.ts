import {
  MemoryItemRegistry,
  isListable,
  type Item,
  type ItemRegistry,
  type TokenId,
} from '@/lib/registry';

export class PortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortError';
  }
}

/**
 * Find item by NFT tokenId via MemoryItemRegistry.listAll when available.
 * After an item-nft redeploy, several AsNft rows can share "0"/"1"/… —
 * pass `preferOwnerId` (seller/buyer) so listing uses that wallet's row.
 * If several rows still match, pick the newest `updatedAt`.
 */
export function findItemByTokenId(
  registry: ItemRegistry,
  tokenId: TokenId,
  preferOwnerId?: string
): Item | undefined {
  if (!(registry instanceof MemoryItemRegistry)) return undefined;
  const matches = registry.listAll().filter((i) => i.tokenId === tokenId);
  if (matches.length === 0) return undefined;

  const newest = (items: Item[]) =>
    items.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));

  if (preferOwnerId) {
    const owned = matches.filter((i) => i.ownerId === preferOwnerId);
    if (owned.length > 0) return newest(owned);
  }
  return newest(matches);
}

/** Require listable AsNft item owned by seller. */
export function requireListableOwned(
  registry: ItemRegistry,
  tokenId: TokenId,
  seller: string
): Item {
  const item = findItemByTokenId(registry, tokenId, seller);
  if (!item) {
    throw new PortError("Couldn't find that NFT in your inventory.");
  }
  if (item.ownerId !== seller) {
    throw new PortError("That's not your NFT.");
  }
  if (!isListable(item)) {
    throw new PortError('Export this item from Play before listing it.');
  }
  return item;
}

/**
 * Transfer Registry ownership after settle (CONTRACTS v2 workaround).
 * No `transferOwnership` on ItemRegistry — MemoryItemRegistry.replaceAll is the bridge.
 */
export function transferItemOwner(
  registry: ItemRegistry,
  itemId: string,
  newOwnerId: string
): void {
  if (!(registry instanceof MemoryItemRegistry)) {
    throw new PortError(
      'Ownership transfer requires MemoryItemRegistry (or LocalStorage subclass)'
    );
  }
  const all = registry.listAll();
  const idx = all.findIndex((i) => i.id === itemId);
  if (idx < 0) throw new PortError(`Item ${itemId} not found for transfer`);
  all[idx] = {
    ...all[idx],
    ownerId: newOwnerId,
    updatedAt: Date.now(),
  };
  registry.replaceAll(all);
}

export function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseXlm(amount: string): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) {
    throw new PortError('Enter a valid XLM amount.');
  }
  return n;
}
