import {
  IllegalTransitionError,
  InvalidArgumentError,
  ItemNotFoundError,
  OwnerMismatchError,
} from './errors';
import type { Item, ItemId, ItemMeta, ItemRegistry, TokenId } from './types';

export interface MemoryItemRegistryOptions {
  /** Optional id factory (defaults to crypto.randomUUID / fallback). */
  idFactory?: () => ItemId;
  /** Optional clock (defaults to Date.now). Useful for tests. */
  now?: () => number;
  /** Seed items (deep-copied into the store). */
  initialItems?: Item[];
}

function defaultIdFactory(): ItemId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneItem(item: Item): Item {
  return {
    ...item,
    meta: {
      ...item.meta,
      attrs: item.meta.attrs ? { ...item.meta.attrs } : undefined,
    },
  };
}

/**
 * In-memory ItemRegistry matching Contracts v2.
 * Safe for Game + Marketplace callers; no React / Stellar imports.
 */
export class MemoryItemRegistry implements ItemRegistry {
  private readonly items = new Map<ItemId, Item>();
  private readonly idFactory: () => ItemId;
  private readonly now: () => number;

  constructor(options: MemoryItemRegistryOptions = {}) {
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => Date.now());
    if (options.initialItems) {
      for (const item of options.initialItems) {
        this.items.set(item.id, cloneItem(item));
      }
    }
  }

  get(id: ItemId): Item | undefined {
    const item = this.items.get(id);
    return item ? cloneItem(item) : undefined;
  }

  listByOwner(ownerId: string): Item[] {
    const result: Item[] = [];
    for (const item of this.items.values()) {
      if (item.ownerId === ownerId) {
        result.push(cloneItem(item));
      }
    }
    return result;
  }

  create(ownerId: string, meta: ItemMeta): Item {
    if (!ownerId) {
      throw new InvalidArgumentError('ownerId is required');
    }
    if (!meta?.name || !meta?.description || !meta?.kind) {
      throw new InvalidArgumentError(
        'meta.name, meta.description, and meta.kind are required'
      );
    }

    const item: Item = {
      id: this.idFactory(),
      ownerId,
      meta: {
        name: meta.name,
        description: meta.description,
        kind: meta.kind,
        attrs: meta.attrs ? { ...meta.attrs } : undefined,
      },
      state: 'InGame',
      updatedAt: this.now(),
    };
    this.items.set(item.id, item);
    return cloneItem(item);
  }

  lockForTrade(id: ItemId, ownerId: string): Item {
    const item = this.requireItem(id);
    this.requireOwner(item, ownerId);
    if (item.state !== 'InGame') {
      throw new IllegalTransitionError(
        id,
        item.state,
        'LockedForTrade',
        'only InGame items can be locked'
      );
    }
    return this.commit(id, {
      ...item,
      state: 'LockedForTrade',
      updatedAt: this.now(),
    });
  }

  unlock(id: ItemId, ownerId: string): Item {
    const item = this.requireItem(id);
    this.requireOwner(item, ownerId);
    if (item.state !== 'LockedForTrade') {
      throw new IllegalTransitionError(
        id,
        item.state,
        'InGame',
        'only LockedForTrade items can be unlocked'
      );
    }
    return this.commit(id, {
      ...item,
      state: 'InGame',
      updatedAt: this.now(),
    });
  }

  markAsNft(id: ItemId, tokenId: TokenId): Item {
    if (!tokenId) {
      throw new InvalidArgumentError('tokenId is required');
    }
    const item = this.requireItem(id);
    if (item.state !== 'LockedForTrade') {
      throw new IllegalTransitionError(
        id,
        item.state,
        'AsNft',
        'only LockedForTrade items can be marked AsNft'
      );
    }
    return this.commit(id, {
      ...item,
      state: 'AsNft',
      tokenId,
      updatedAt: this.now(),
    });
  }

  markInGame(id: ItemId): Item {
    const item = this.requireItem(id);
    if (item.state !== 'AsNft') {
      throw new IllegalTransitionError(
        id,
        item.state,
        'InGame',
        'only AsNft items can be marked InGame'
      );
    }
    const next: Item = {
      ...item,
      state: 'InGame',
      updatedAt: this.now(),
    };
    delete next.tokenId;
    return this.commit(id, next);
  }

  /** Snapshot of all items (for persistence adapters / tests). */
  listAll(): Item[] {
    return Array.from(this.items.values()).map(cloneItem);
  }

  /** Replace store contents (used by localStorage hydrate). */
  replaceAll(items: Item[]): void {
    this.items.clear();
    for (const item of items) {
      this.items.set(item.id, cloneItem(item));
    }
  }

  private requireItem(id: ItemId): Item {
    const item = this.items.get(id);
    if (!item) {
      throw new ItemNotFoundError(id);
    }
    return item;
  }

  private requireOwner(item: Item, ownerId: string): void {
    if (item.ownerId !== ownerId) {
      throw new OwnerMismatchError(item.id, ownerId);
    }
  }

  private commit(id: ItemId, item: Item): Item {
    this.items.set(id, item);
    return cloneItem(item);
  }
}
