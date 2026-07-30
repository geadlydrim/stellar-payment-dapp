import { MemoryItemRegistry } from './memory-registry';
import type { Item } from './types';

export const DEFAULT_REGISTRY_STORAGE_KEY = 'stellar4:item-registry';

export interface LocalStorageItemRegistryOptions {
  storageKey?: string;
  /** Inject storage (defaults to globalThis.localStorage when present). */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  idFactory?: () => string;
  now?: () => number;
}

/**
 * Memory registry that hydrates from / persists to localStorage when available.
 * Falls back to in-memory-only when storage is missing (SSR / Node).
 */
export class LocalStorageItemRegistry extends MemoryItemRegistry {
  private readonly storageKey: string;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;

  constructor(options: LocalStorageItemRegistryOptions = {}) {
    const storage =
      options.storage ??
      (typeof globalThis !== 'undefined' && 'localStorage' in globalThis
        ? globalThis.localStorage
        : null);

    let initialItems: Item[] | undefined;
    if (storage) {
      const raw = storage.getItem(options.storageKey ?? DEFAULT_REGISTRY_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            initialItems = parsed as Item[];
          }
        } catch {
          // Corrupt payload — start empty rather than crash callers.
          initialItems = undefined;
        }
      }
    }

    super({
      idFactory: options.idFactory,
      now: options.now,
      initialItems,
    });

    this.storageKey = options.storageKey ?? DEFAULT_REGISTRY_STORAGE_KEY;
    this.storage = storage;
  }

  override create(...args: Parameters<MemoryItemRegistry['create']>) {
    const item = super.create(...args);
    this.persist();
    return item;
  }

  override lockForTrade(...args: Parameters<MemoryItemRegistry['lockForTrade']>) {
    const item = super.lockForTrade(...args);
    this.persist();
    return item;
  }

  override unlock(...args: Parameters<MemoryItemRegistry['unlock']>) {
    const item = super.unlock(...args);
    this.persist();
    return item;
  }

  override markAsNft(...args: Parameters<MemoryItemRegistry['markAsNft']>) {
    const item = super.markAsNft(...args);
    this.persist();
    return item;
  }

  override markInGame(...args: Parameters<MemoryItemRegistry['markInGame']>) {
    const item = super.markInGame(...args);
    this.persist();
    return item;
  }

  override replaceAll(items: Item[]): void {
    super.replaceAll(items);
    this.persist();
  }

  clearPersisted(): void {
    this.replaceAll([]);
    this.storage?.removeItem(this.storageKey);
  }

  private persist(): void {
    if (!this.storage) return;
    this.storage.setItem(this.storageKey, JSON.stringify(this.listAll()));
  }
}
