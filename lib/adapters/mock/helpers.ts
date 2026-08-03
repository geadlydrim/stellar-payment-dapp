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

/** Find item by NFT tokenId via MemoryItemRegistry.listAll when available. */
export function findItemByTokenId(
  registry: ItemRegistry,
  tokenId: TokenId
): Item | undefined {
  if (registry instanceof MemoryItemRegistry) {
    return registry.listAll().find((i) => i.tokenId === tokenId);
  }
  return undefined;
}

/** Require listable AsNft item owned by seller. */
export function requireListableOwned(
  registry: ItemRegistry,
  tokenId: TokenId,
  seller: string
): Item {
  const item = findItemByTokenId(registry, tokenId);
  if (!item) {
    throw new PortError(`No item found for tokenId ${tokenId}`);
  }
  if (item.ownerId !== seller) {
    throw new PortError('Not the owner of this NFT');
  }
  if (!isListable(item)) {
    throw new PortError(
      `Item is not listable (state=${item.state}, tokenId=${item.tokenId ?? 'none'})`
    );
  }
  return item;
}

/**
 * Transfer Registry ownership after mock settle.
 * CONTRACTS v2 has no transfer API — MemoryItemRegistry.replaceAll is the Phase C bridge.
 * Stellar adapters will transfer on-chain then sync ownerId (or a future Registry method).
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
    throw new PortError(`Invalid XLM amount: ${amount}`);
  }
  return n;
}
